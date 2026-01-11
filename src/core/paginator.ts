// // src/core/Paginator.ts
// export class Paginator {
//   private paginationDefaults: PaginationDefaults;

//   constructor(paginationDefaults: PaginationDefaults) {
//     this.paginationDefaults = paginationDefaults;
//   }

//   private getPaginationOptions(options: PaginationOptions): {
//     page: number;
//     limit: number;
//     skip: number;
//   } {
//     const page = Number(options.page ?? this.paginationDefaults.page);
//     const limit = Number(options.limit ?? this.paginationDefaults.limit);

//     // validate and sanitize
//     const safePage = Number.isFinite(page) && page > 0 ? page : this.paginationDefaults.page!;
//     const safeLimit = Number.isFinite(limit) && limit > 0
//       ? Math.min(limit, this.paginationDefaults.maxLimit!)
//       : this.paginationDefaults.limit!;

//     return {
//       page: safePage,
//       limit: safeLimit,
//       skip: (safePage - 1) * safeLimit,
//     };
//   }

//   static async paginateQuery<T extends Document>(
//     model: Model<T>,
//     options: QueryPaginationOptions<T>,
//     paginationDefaults: PaginationDefaults,  // injected
//   ): Promise<PaginatedResult<any>> {
//     const paginator = new Paginator(paginationDefaults);
//     const { page, limit, skip } = paginator.getPaginationOptions(options);

//     const filter = options.filter || {};

//     let query: QueryWithHelpers<any, T> = model
//       .find(filter, options.projection)
//       .skip(skip)
//       .limit(limit);

//     if (options.sort) query = query.sort(options.sort);
//     if (options.populate) query = query.populate(options.populate as any);
//     if (options.lean) query = query.lean();

//     const [docs, totalDocs] = await Promise.all([
//       query.exec(),
//       model.countDocuments(filter).exec(),
//     ]);

//     const totalPages = Math.ceil(totalDocs / limit) || 1;
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     return {
//       docs,
//       totalDocs,
//       limit,
//       page,
//       totalPages,
//       hasNextPage,
//       hasPrevPage,
//       nextPage: hasNextPage ? page + 1 : null,
//       prevPage: hasPrevPage ? page - 1 : null,
//     };
//   }

//   // same for paginateAggregate...
// }

// src/core/Paginator.ts

// import type {
//   Aggregate,
//   Document,
//   Model,
//   PopulateOptions,
//   QueryWithHelpers,
// } from "mongoose";
// import { PaginationDefaults } from "../config/types";
// import { PaginatedResult } from "./types";

// export interface QueryPaginationOptions<T extends Document> {
//   page?: number;
//   limit?: number;
//   sort?: any;
//   filter?: Record<string, any>;
//   projection?: any;
//   populate?: string | PopulateOptions | (string | PopulateOptions)[];
//   lean?: boolean;
// }

// export interface AggregatePaginationOptions {
//   page?: number;
//   limit?: number;
//   pipeline?: any[];
// }

// export class Paginator {
//   private paginationDefaults: Required<PaginationDefaults>;

//   constructor(paginationDefaults: Required<PaginationDefaults>) {
//     this.paginationDefaults = paginationDefaults;
//   }

//   private normalize(options: { page?: number; limit?: number }) {
//     const rawPage = Number(options.page ?? this.paginationDefaults.page);
//     const rawLimit = Number(options.limit ?? this.paginationDefaults.limit);

//     const page =
//       Number.isFinite(rawPage) && rawPage > 0
//         ? rawPage
//         : this.paginationDefaults.page;
//     let limit =
//       Number.isFinite(rawLimit) && rawLimit > 0
//         ? rawLimit
//         : this.paginationDefaults.limit;

//     if (
//       this.paginationDefaults.maxLimit &&
//       limit > this.paginationDefaults.maxLimit
//     ) {
//       limit = this.paginationDefaults.maxLimit;
//     }

//     const skip = (page - 1) * limit;

//     return { page, limit, skip };
//   }

//   async paginateQuery<T extends Document>(
//     model: Model<T>,
//     options: QueryPaginationOptions<T>
//   ): Promise<PaginatedResult<any>> {
//     const { page, limit, skip } = this.normalize(options);
//     const filter = options.filter || {};

//     let query: QueryWithHelpers<any, T> = model
//       .find(filter, options.projection)
//       .skip(skip)
//       .limit(limit);

//     if (options.sort) query = query.sort(options.sort);
//     if (options.populate) query = query.populate(options.populate as any);
//     if (options.lean) query = query.lean();

//     const [docs, totalDocs] = await Promise.all([
//       query.exec(),
//       model.countDocuments(filter).exec(),
//     ]);

//     const totalPages = Math.ceil(totalDocs / limit) || 1;
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     return {
//       docs,
//       totalDocs,
//       limit,
//       page,
//       totalPages,
//       hasNextPage,
//       hasPrevPage,
//       nextPage: hasNextPage ? page + 1 : null,
//       prevPage: hasPrevPage ? page - 1 : null,
//     };
//   }

//   /**
//    * Paginate an aggregate query.
//    * @param {Model<any>} model - mongoose model
//    * @param {AggregatePaginationOptions} options - pagination options
//    * @returns {Promise<PaginatedResult<T>>} - paginated result
//    */
//   async paginateAggregate<T>(
//     model: Model<any>,
//     options: AggregatePaginationOptions
//   ): Promise<PaginatedResult<T>> {
//     const { page, limit, skip } = this.normalize(options);
//     const basePipeline = options.pipeline ?? model.aggregate().pipeline();
//     const pagePipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];
//     const countPipeline = [...basePipeline, { $count: "totalDocs" }];

//     const [docs, countResult] = await Promise.all([
//       model.aggregate(pagePipeline).exec(),
//       model.aggregate(countPipeline).exec(),
//     ]);

//     const totalDocs = countResult[0]?.totalDocs ?? 0;
//     const totalPages = Math.ceil(totalDocs / limit) || 1;
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     return {
//       docs,
//       totalDocs,
//       limit,
//       page,
//       totalPages,
//       hasNextPage,
//       hasPrevPage,
//       nextPage: hasNextPage ? page + 1 : null,
//       prevPage: hasPrevPage ? page - 1 : null,
//     };
//   }
// }


// src/core/paginator.ts

import type {
  Document,
  Model,
  PopulateOptions,
  QueryWithHelpers,
} from "mongoose";
import { PaginationDefaults } from "../config/types";
import { PaginatedResult } from "./types";

export type TransformFn<T, R> = (doc: T) => R;

export interface QueryPaginationOptions<T extends Document> {
  page?: number;
  limit?: number;
  sort?: any;
  filter?: Record<string, any>;
  projection?: any;
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  lean?: boolean;
}

export interface AggregatePaginationOptions {
  page?: number;
  limit?: number;
  pipeline?: any[];
}

export class Paginator {
  private paginationDefaults: Required<PaginationDefaults>;

  constructor(paginationDefaults: Required<PaginationDefaults>) {
    this.paginationDefaults = paginationDefaults;
  }

  private normalize(options: { page?: number; limit?: number }) {
    const rawPage = Number(options.page ?? this.paginationDefaults.page);
    const rawLimit = Number(options.limit ?? this.paginationDefaults.limit);

    const page =
      Number.isFinite(rawPage) && rawPage > 0
        ? rawPage
        : this.paginationDefaults.page;
    let limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? rawLimit
        : this.paginationDefaults.limit;

    if (
      this.paginationDefaults.maxLimit &&
      limit > this.paginationDefaults.maxLimit
    ) {
      limit = this.paginationDefaults.maxLimit;
    }

    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }

  /**
   * Paginate a standard Mongoose query.
   * Supports an optional transform function to clean data (DTO).
   */
  async paginateQuery<T extends Document, R = T>(
    model: Model<T>,
    options: QueryPaginationOptions<T>,
    transform?: TransformFn<T, R>
  ): Promise<PaginatedResult<R>> {
    const { page, limit, skip } = this.normalize(options);
    const filter = options.filter || {};

    let query: QueryWithHelpers<any, T> = model
      .find(filter, options.projection)
      .skip(skip)
      .limit(limit);

    if (options.sort) query = query.sort(options.sort);
    if (options.populate) query = query.populate(options.populate as any);
    if (options.lean) query = query.lean();

    const [docs, totalDocs] = await Promise.all([
      query.exec(),
      model.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(totalDocs / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Apply transformation if provided
    const resultDocs = transform ? docs.map(transform) : (docs as unknown as R[]);

    return {
      docs: resultDocs,
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    };
  }

  
  async paginateAggregate<T = any, R = T>(
    model: Model<any>,
    options: AggregatePaginationOptions,
    transform?: TransformFn<T, R>
  ): Promise<PaginatedResult<R>> {
    const { page, limit, skip } = this.normalize(options);
    
    // Fallback to model's default pipeline if none provided
    const basePipeline = options.pipeline ?? [];
    const pagePipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];
    const countPipeline = [...basePipeline, { $count: "totalDocs" }];

    const [docs, countResult] = await Promise.all([
      model.aggregate(pagePipeline).exec(),
      model.aggregate(countPipeline).exec(),
    ]);

    const totalDocs = countResult[0]?.totalDocs ?? 0;
    const totalPages = Math.ceil(totalDocs / limit) || 1;
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Apply transformation to the raw aggregate results
    const resultDocs = transform ? docs.map(transform) : (docs as R[]);

    return {
      docs: resultDocs,
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    };
  }
}