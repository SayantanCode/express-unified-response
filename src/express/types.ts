// // src/express/types.ts
// export interface ResponseHelpers {
//   success: <T>(data: T, message?: string) => void;
//   created: <T>(data: T, message?: string) => void;
//   updated: <T>(data?: T, message?: string) => void;
//   deleted: (message?: string) => void;
//   list: <T>(items: T[], message?: string) => void;
//   paginated: <T>(result: any, message?: string) => void;
//   error: (err: unknown) => void;
//   paginateQuery: <T = any>(
//     model: any,
//     options: any,
//     message?: string,
//   ) => Promise<void>;
//   paginateAggregate: <T = any>(
//     aggregate: any,
//     options: any,
//     message?: string,
//   ) => Promise<void>;
// }

// import { PaginatedResult } from "../core/types";
import { TransformFn } from "../core/paginator";

export interface ResponseOptions<T, R> {
  transform?: TransformFn<T, R>;
  silent?: boolean;
}

export interface ListOptions<T = any, R = any> extends ResponseOptions<T, R> {
  paginate?: boolean;
  page?: number | string;
  limit?: number | string;
}

export interface QueryOptions<T = any, R = any> extends ListOptions<T, R> {
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1 | "asc" | "desc">;
  projection?: Record<string, 0 | 1>;
  populate?: string | string[] | Record<string, any> | Record<string, any>[];
  select?: string;
  lean?: boolean;
  /** Skip counting totalDocs. totalDocs/totalPages will be -1. Use for infinite scroll. */
  skipCount?: boolean;
  /** Use estimatedDocumentCount() instead of countDocuments(). Much faster on large unfiltered collections. */
  useEstimatedCount?: boolean;
}
export interface AggregateOptions<T = any, R = any> extends ListOptions<T, R> {
  pipeline: any[]; // Required for aggregate
  /** Allow MongoDB to spill to disk for large pipelines. */
  allowDiskUse?: boolean;
  /** Skip the count pipeline. totalDocs will be -1. */
  skipCount?: boolean;
}

/** Options for res.paginateRaw() — offset pagination with pre-fetched data. */
export interface RawPaginationOptions<T = any, R = any> extends ResponseOptions<T, R> {
  page?: number | string;
  limit?: number | string;
}

/** Cursor meta passed to res.paginateCursorRaw(). */
export interface RawCursorMeta {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}

export interface CursorOptions<T = any, R = any> extends ResponseOptions<T, R> {
  cursor?: string;
  limit?: number | string;
  cursorField?: string;
  /** "asc" = oldest-first ($gt), "desc" = newest-first ($lt). Default: "asc". */
  cursorDirection?: "asc" | "desc";
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1 | "asc" | "desc">;
  projection?: Record<string, 0 | 1>;
  populate?: string | string[] | Record<string, any> | Record<string, any>[];
  select?: string;
  lean?: boolean;
}
// export interface RequestWithStartTime extends Request {
//   startTime: number;
// }

declare module "express-serve-static-core" {
  interface Request {
    startTime?: number;
  }
  interface Response {
    //------------- Basic Methods ----------------

    /** 200 OK — standard success response. Unwraps Mongoose `_doc` automatically. */
    success: <T, R = T>(
      data: T,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    /** 202 Accepted — use for async operations that are queued and not yet resolved. */
    accepted: <T, R = T>(
      data?: T,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    /** 201 Created — use after successful resource creation. Unwraps Mongoose `_doc` automatically. */
    created: <T, R = T>(
      data: T,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    /**
     * 200 OK or 204 No Content depending on whether data/message is provided
     * and the `restDefaults.updateReturnsBody` config (default: `true` → 200).
     */
    updated: <T, R = T>(
      data?: T | null,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    /**
     * 204 No Content (default) or 200 OK depending on `restDefaults.deleteReturnsNoContent`
     * (default: `true` → 204). Providing data or a message always returns 200.
     */
    deleted: <T, R = T>(data?: T, message?: string, options?: ResponseOptions<T, R>) => void;

    /** 204 No Content — explicit no-body response for non-delete endpoints (PATCH triggers, HEAD, job actions). */
    noContent: (options?: { silent?: boolean }) => void;

    //------------- Paginated Methods ----------------

    /**
     * Paginates an in-memory array. Use `paginate: false` to return all items with a meta block.
     * Non-paginated lists are capped at `restDefaults.nonPaginatedMaxItems` (default 1000).
     */
    list: <T, R = T>(
      data: T[],
      options?: ListOptions<T, R>,
      message?: string
    ) => Promise<void>;

    /**
     * Mongoose offset pagination — runs `find()` + `countDocuments()` in parallel.
     * Requires a Mongoose Model. For other ORMs use `res.paginateRaw()`.
     */
    paginateQuery: <T, R = T>(
      model: any,
      options: QueryOptions<T, R>,
      message?: string
    ) => Promise<void>;

    /**
     * Mongoose aggregate offset pagination — appends `$skip`/`$limit` to your pipeline
     * and runs a separate count pipeline in parallel.
     * Requires a Mongoose Model with `aggregate()`.
     */
    paginateAggregate: <T, R = T>(
      model: any,
      options: AggregateOptions<T, R>,
      message?: string
    ) => Promise<void>;

    /**
     * Mongoose cursor pagination — no `totalDocs`, uses `nextCursor` for navigation.
     * Fetches `limit + 1` to detect the next page without a count query.
     * Requires a Mongoose Model. For other ORMs use `res.paginateCursorRaw()`.
     */
    paginateCursor: <T, R = T>(
      model: any,
      options: CursorOptions<T, R>,
      message?: string
    ) => Promise<void>;

    /**
     * Offset pagination with pre-fetched docs and a known total count.
     * Use for any ORM (Prisma, TypeORM, Drizzle, pg) where you run the query yourself.
     */
    paginateRaw: <T, R = T>(
      docs: T[],
      totalDocs: number,
      options?: RawPaginationOptions<T, R>,
      message?: string
    ) => Promise<void>;

    /**
     * Cursor pagination with pre-fetched docs and pre-computed cursor meta.
     * Use for any ORM that supports cursor-based queries (e.g. Prisma cursor API).
     */
    paginateCursorRaw: <T, R = T>(
      docs: T[],
      meta: RawCursorMeta,
      options?: ResponseOptions<T, R>,
      message?: string
    ) => Promise<void>;
  }
}

export {};
