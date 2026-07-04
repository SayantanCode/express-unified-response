// src/core/paginator.ts

import type {
  Document,
  Model,
  PopulateOptions,
  QueryFilter,
  QueryWithHelpers,
} from "mongoose";
import { PaginationDefaults } from "../config/types";
import { PaginatedResult, CursorPaginatedResult } from "./types";
import { AppError } from "./errors";
import { internalLogger } from "../utils/logger";

function cursorToString(value: any): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// Separate cap for res.list() (non-paginated) vs per-page limit for paginated queries
type PaginatorConfig = Required<PaginationDefaults> & {
  nonPaginatedMaxItems?: number;
  /** Routes package-level warnings through the user's configured logger.onWarn instead of console.warn. */
  warn?: (message: string, context?: unknown) => void;
};

export type TransformFn<T, R> = (doc: T) => R;

export interface QueryPaginationOptions<T extends Document> {
  paginate?: boolean;
  page?: number | string;
  limit?: number | string;
  sort?: any;
  filter?: QueryFilter<T>;
  projection?: any;
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  select?: string;
  lean?: boolean;
  transform?: TransformFn<T, any>;
  /**
   * Skip the count query entirely. `totalDocs`, `totalPages`, `nextPage`, `prevPage`
   * will be -1/null. Use for infinite scroll where total count is not needed.
   */
  skipCount?: boolean;
  /**
   * Use estimatedDocumentCount() instead of countDocuments() for the total.
   * Dramatically faster on large unfiltered collections. Only use when filter is empty or minimal.
   */
  useEstimatedCount?: boolean;
}

export interface AggregatePaginationOptions {
  paginate?: boolean;
  page?: number | string;
  limit?: number | string;
  pipeline?: any[];
  transform?: TransformFn<any, any>;
  /** Allow MongoDB to use disk for large aggregate pipelines (sets allowDiskUse: true). */
  allowDiskUse?: boolean;
  /** Skip the count pipeline. totalDocs will be -1. Use when count is not needed. */
  skipCount?: boolean;
}

export interface ListPaginationOptions<T, R> {
  paginate?: boolean;
  page?: number | string;
  limit?: number | string;
  transform?: TransformFn<T, R>;
}

export interface CursorPaginationOptions<T extends Document> {
  cursor?: string;
  limit?: number | string;
  cursorField?: string;
  /** "asc" (default) = oldest-first, next page uses $gt. "desc" = newest-first, next page uses $lt. */
  cursorDirection?: "asc" | "desc";
  filter?: QueryFilter<T>;
  sort?: any;
  projection?: any;
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  select?: string;
  lean?: boolean;
  transform?: TransformFn<T, any>;
}

export class Paginator {
  private paginationDefaults: PaginatorConfig;

  constructor(paginationDefaults: PaginatorConfig) {
    this.paginationDefaults = paginationDefaults;
  }

  private normalize(options: { page?: number | string; limit?: number | string }) {
    const rawPage = Number(options.page ?? this.paginationDefaults.page);
    const rawLimit = Number(options.limit ?? this.paginationDefaults.limit);

    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : this.paginationDefaults.page;
    let limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : this.paginationDefaults.limit;

    if (this.paginationDefaults.maxLimit && limit > this.paginationDefaults.maxLimit) {
      limit = this.paginationDefaults.maxLimit;
    }

    const skip = (page - 1) * limit;
    return { page, limit, skip };
  }

  private buildResult<R>(docs: R[], totalDocs: number, page: number, limit: number, isPaginated: boolean): PaginatedResult<R> {
    const effectiveLimit = isPaginated ? limit : totalDocs;
    const totalPages = isPaginated ? (Math.ceil(totalDocs / limit) || 1) : 1;
    const hasNextPage = isPaginated ? page < totalPages : false;
    const hasPrevPage = isPaginated ? page > 1 : false;

    return {
      docs,
      totalDocs,
      limit: effectiveLimit,
      page: isPaginated ? page : 1,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    };
  }

  async paginateQuery<T extends Document, R = T>(
    model: Model<T>,
    options: QueryPaginationOptions<T>
  ): Promise<PaginatedResult<R>> {
    if (typeof (model as any)?.find !== "function" || typeof (model as any)?.countDocuments !== "function") {
      throw new AppError(
        "paginateQuery requires a Mongoose Model. For other ORMs (Prisma, TypeORM, Drizzle), " +
        "paginate manually and pass the results to res.list().",
        500,
        "INVALID_MODEL"
      );
    }

    if (options.lean && options.populate) {
      throw new AppError(
        "lean and populate cannot be used together — lean skips Mongoose document hydration which populate requires",
        500,
        "INVALID_QUERY_OPTIONS"
      );
    }

    if (options.useEstimatedCount && options.filter && Object.keys(options.filter).length > 0) {
      const warn = this.paginationDefaults.warn ?? internalLogger.warn;
      warn(
        "useEstimatedCount: true ignores the filter — estimatedDocumentCount() counts ALL documents. " +
        "Remove useEstimatedCount or remove the filter to avoid incorrect totalDocs/totalPages."
      );
    }

    const { page, limit, skip } = this.normalize(options);
    const isPaginated = options.paginate !== false;
    const filter = options.filter || {};

    let query: QueryWithHelpers<any, T> = model.find(filter, options.projection);

    if (isPaginated) {
      query = query.skip(skip).limit(limit);
    }

    if (options.sort) query = query.sort(options.sort);
    if (options.populate) query = query.populate(options.populate as any);
    if (options.select) query = query.select(options.select);
    if (options.lean) query = query.lean();

    // Not paginated — fetch all, use docs.length as total, no count query needed
    if (!isPaginated) {
      const docs = await query.exec();
      return this.buildResult(docs as unknown as R[], docs.length, page, limit, false);
    }

    // skipCount — caller doesn't need totalDocs/totalPages (e.g. infinite scroll)
    if (options.skipCount) {
      const docs = await query.exec();
      return this.buildResult(docs as unknown as R[], -1, page, limit, true);
    }

    // Normal paginated — run docs + count in parallel
    const countFn = options.useEstimatedCount
      ? model.estimatedDocumentCount()
      : model.countDocuments(filter);

    const [docs, count] = await Promise.all([query.exec(), countFn.exec()]);
    return this.buildResult(docs as unknown as R[], count, page, limit, true);
  }

  async paginateAggregate<T = any, R = T>(
    model: Model<any>,
    options: AggregatePaginationOptions
  ): Promise<PaginatedResult<R>> {
    if (typeof (model as any)?.aggregate !== "function") {
      throw new AppError(
        "paginateAggregate requires a Mongoose Model with an aggregate() method. " +
        "For other ORMs, run your query manually and pass the results to res.list().",
        500,
        "INVALID_MODEL"
      );
    }

    const { page, limit, skip } = this.normalize(options);
    const isPaginated = options.paginate !== false;

    const basePipeline = options.pipeline ?? [];

    // Strip any $skip/$limit stages the developer may have included in their pipeline —
    // if present they would corrupt the total count (count would reflect the capped subset).
    const countPipeline = [
      ...basePipeline.filter((stage) => !("$skip" in stage) && !("$limit" in stage)),
      { $count: "totalDocs" },
    ];

    const pagePipeline = [...basePipeline];
    if (isPaginated) {
      pagePipeline.push({ $skip: skip }, { $limit: limit });
    }

    const docsQuery = model.aggregate(pagePipeline);
    if (options.allowDiskUse) docsQuery.allowDiskUse(true);

    if (options.skipCount) {
      const docs = await docsQuery.exec();
      return this.buildResult(docs as R[], -1, page, limit, isPaginated);
    }

    const countQuery = model.aggregate(countPipeline);
    if (options.allowDiskUse) countQuery.allowDiskUse(true);

    const [docs, countResult] = await Promise.all([docsQuery.exec(), countQuery.exec()]);
    const totalDocs = countResult[0]?.totalDocs ?? 0;
    return this.buildResult(docs as R[], totalDocs, page, limit, isPaginated);
  }

  async paginateList<T = any, R = T>(
    items: T[],
    options: ListPaginationOptions<T, R>
  ): Promise<PaginatedResult<R>> {
    const { page, limit, skip } = this.normalize(options);
    const isPaginated = options.paginate !== false;

    const totalDocs = items.length;

    let resultItems: T[];
    if (!isPaginated) {
      // Cap non-paginated lists using nonPaginatedMaxItems (separate from per-page maxLimit)
      const cap = this.paginationDefaults.nonPaginatedMaxItems ?? this.paginationDefaults.maxLimit;
      resultItems = cap ? items.slice(0, cap) : items;
    } else {
      resultItems = items.slice(skip, skip + limit);
    }

    return this.buildResult(resultItems as unknown as R[], totalDocs, page, limit, isPaginated);
  }

  async paginateCursor<T extends Document, R = T>(
    model: Model<T>,
    options: CursorPaginationOptions<T>
  ): Promise<CursorPaginatedResult<R>> {
    if (typeof (model as any)?.find !== "function") {
      throw new AppError(
        "paginateCursor requires a Mongoose Model. For other ORMs, use cursor-based pagination " +
        "manually and pass the results to res.list().",
        500,
        "INVALID_MODEL"
      );
    }

    if (options.lean && options.populate) {
      throw new AppError(
        "lean and populate cannot be used together — lean skips Mongoose document hydration which populate requires",
        500,
        "INVALID_QUERY_OPTIONS"
      );
    }

    const rawLimit = Number(options.limit ?? this.paginationDefaults.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, this.paginationDefaults.maxLimit)
      : this.paginationDefaults.limit;

    const cursorField = options.cursorField ?? "_id";
    const direction = options.cursorDirection ?? "asc";
    const filter = options.filter ?? {};

    const cursorOp = direction === "desc" ? "$lt" : "$gt";
    const cursorFilter = options.cursor
      ? { ...filter, [cursorField]: { [cursorOp]: options.cursor } }
      : filter;

    const sortDir = direction === "desc" ? -1 : 1;
    // Fetch one extra document to determine hasNextPage without a count query
    let query: any = model
      .find(cursorFilter, options.projection)
      .sort({ [cursorField]: sortDir, ...(options.sort ?? {}) })
      .limit(limit + 1);

    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate as any);
    if (options.lean) query = query.lean();

    const docs: any[] = await query.exec();
    const hasNextPage = docs.length > limit;
    if (hasNextPage) docs.pop();

    const nextCursor = hasNextPage && docs.length > 0
      ? cursorToString(docs[docs.length - 1][cursorField])
      : null;

    return { docs: docs as unknown as R[], nextCursor, hasNextPage, limit };
  }

  /**
   * Build a PaginatedResult from already-fetched docs and a known total count.
   * Use this when the DB query (Prisma, TypeORM, pg, etc.) handles pagination itself.
   * No maxLimit enforcement — caller controls the query.
   */
  fromRaw<T = any, R = T>(
    docs: T[],
    totalDocs: number,
    options: { page?: number | string; limit?: number | string }
  ): PaginatedResult<R> {
    const rawPage = Number(options.page ?? this.paginationDefaults.page);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : this.paginationDefaults.page;

    // Prefer the declared limit; fall back to actual docs length, then default.
    // No maxLimit cap — the caller already ran the query with their own limit.
    const rawLimit = Number(options.limit ?? (docs.length || this.paginationDefaults.limit));
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : this.paginationDefaults.limit;

    return this.buildResult(docs as unknown as R[], totalDocs, page, limit, true);
  }

  /**
   * Build a CursorPaginatedResult from already-fetched docs and pre-computed cursor meta.
   * Use when the ORM handles cursor pagination itself (e.g. Prisma cursor API).
   * The caller is responsible for the limit+1 trick and computing nextCursor.
   */
  fromCursorRaw<T = any, R = T>(
    docs: T[],
    meta: { nextCursor: string | null; hasNextPage: boolean; limit: number }
  ): CursorPaginatedResult<R> {
    return {
      docs: docs as unknown as R[],
      nextCursor: meta.nextCursor,
      hasNextPage: meta.hasNextPage,
      limit: meta.limit,
    };
  }
}
