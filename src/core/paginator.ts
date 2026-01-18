// // // src/core/Paginator.ts
// // export class Paginator {
// //   private paginationDefaults: PaginationDefaults;

// //   constructor(paginationDefaults: PaginationDefaults) {
// //     this.paginationDefaults = paginationDefaults;
// //   }

// //   private getPaginationOptions(options: PaginationOptions): {
// //     page: number;
// //     limit: number;
// //     skip: number;
// //   } {
// //     const page = Number(options.page ?? this.paginationDefaults.page);
// //     const limit = Number(options.limit ?? this.paginationDefaults.limit);

// //     // validate and sanitize
// //     const safePage = Number.isFinite(page) && page > 0 ? page : this.paginationDefaults.page!;
// //     const safeLimit = Number.isFinite(limit) && limit > 0
// //       ? Math.min(limit, this.paginationDefaults.maxLimit!)
// //       : this.paginationDefaults.limit!;

// //     return {
// //       page: safePage,
// //       limit: safeLimit,
// //       skip: (safePage - 1) * safeLimit,
// //     };
// //   }

// //   static async paginateQuery<T extends Document>(
// //     model: Model<T>,
// //     options: QueryPaginationOptions<T>,
// //     paginationDefaults: PaginationDefaults,  // injected
// //   ): Promise<PaginatedResult<any>> {
// //     const paginator = new Paginator(paginationDefaults);
// //     const { page, limit, skip } = paginator.getPaginationOptions(options);

// //     const filter = options.filter || {};

// //     let query: QueryWithHelpers<any, T> = model
// //       .find(filter, options.projection)
// //       .skip(skip)
// //       .limit(limit);

// //     if (options.sort) query = query.sort(options.sort);
// //     if (options.populate) query = query.populate(options.populate as any);
// //     if (options.lean) query = query.lean();

// //     const [docs, totalDocs] = await Promise.all([
// //       query.exec(),
// //       model.countDocuments(filter).exec(),
// //     ]);

// //     const totalPages = Math.ceil(totalDocs / limit) || 1;
// //     const hasNextPage = page < totalPages;
// //     const hasPrevPage = page > 1;

// //     return {
// //       docs,
// //       totalDocs,
// //       limit,
// //       page,
// //       totalPages,
// //       hasNextPage,
// //       hasPrevPage,
// //       nextPage: hasNextPage ? page + 1 : null,
// //       prevPage: hasPrevPage ? page - 1 : null,
// //     };
// //   }

// //   // same for paginateAggregate...
// // }

// // src/core/Paginator.ts

// // import type {
// //   Aggregate,
// //   Document,
// //   Model,
// //   PopulateOptions,
// //   QueryWithHelpers,
// // } from "mongoose";
// // import { PaginationDefaults } from "../config/types";
// // import { PaginatedResult } from "./types";

// // export interface QueryPaginationOptions<T extends Document> {
// //   page?: number;
// //   limit?: number;
// //   sort?: any;
// //   filter?: Record<string, any>;
// //   projection?: any;
// //   populate?: string | PopulateOptions | (string | PopulateOptions)[];
// //   lean?: boolean;
// // }

// // export interface AggregatePaginationOptions {
// //   page?: number;
// //   limit?: number;
// //   pipeline?: any[];
// // }

// // export class Paginator {
// //   private paginationDefaults: Required<PaginationDefaults>;

// //   constructor(paginationDefaults: Required<PaginationDefaults>) {
// //     this.paginationDefaults = paginationDefaults;
// //   }

// //   private normalize(options: { page?: number; limit?: number }) {
// //     const rawPage = Number(options.page ?? this.paginationDefaults.page);
// //     const rawLimit = Number(options.limit ?? this.paginationDefaults.limit);

// //     const page =
// //       Number.isFinite(rawPage) && rawPage > 0
// //         ? rawPage
// //         : this.paginationDefaults.page;
// //     let limit =
// //       Number.isFinite(rawLimit) && rawLimit > 0
// //         ? rawLimit
// //         : this.paginationDefaults.limit;

// //     if (
// //       this.paginationDefaults.maxLimit &&
// //       limit > this.paginationDefaults.maxLimit
// //     ) {
// //       limit = this.paginationDefaults.maxLimit;
// //     }

// //     const skip = (page - 1) * limit;

// //     return { page, limit, skip };
// //   }

// //   async paginateQuery<T extends Document>(
// //     model: Model<T>,
// //     options: QueryPaginationOptions<T>
// //   ): Promise<PaginatedResult<any>> {
// //     const { page, limit, skip } = this.normalize(options);
// //     const filter = options.filter || {};

// //     let query: QueryWithHelpers<any, T> = model
// //       .find(filter, options.projection)
// //       .skip(skip)
// //       .limit(limit);

// //     if (options.sort) query = query.sort(options.sort);
// //     if (options.populate) query = query.populate(options.populate as any);
// //     if (options.lean) query = query.lean();

// //     const [docs, totalDocs] = await Promise.all([
// //       query.exec(),
// //       model.countDocuments(filter).exec(),
// //     ]);

// //     const totalPages = Math.ceil(totalDocs / limit) || 1;
// //     const hasNextPage = page < totalPages;
// //     const hasPrevPage = page > 1;

// //     return {
// //       docs,
// //       totalDocs,
// //       limit,
// //       page,
// //       totalPages,
// //       hasNextPage,
// //       hasPrevPage,
// //       nextPage: hasNextPage ? page + 1 : null,
// //       prevPage: hasPrevPage ? page - 1 : null,
// //     };
// //   }

// //   /**
// //    * Paginate an aggregate query.
// //    * @param {Model<any>} model - mongoose model
// //    * @param {AggregatePaginationOptions} options - pagination options
// //    * @returns {Promise<PaginatedResult<T>>} - paginated result
// //    */
// //   async paginateAggregate<T>(
// //     model: Model<any>,
// //     options: AggregatePaginationOptions
// //   ): Promise<PaginatedResult<T>> {
// //     const { page, limit, skip } = this.normalize(options);
// //     const basePipeline = options.pipeline ?? model.aggregate().pipeline();
// //     const pagePipeline = [...basePipeline, { $skip: skip }, { $limit: limit }];
// //     const countPipeline = [...basePipeline, { $count: "totalDocs" }];

// //     const [docs, countResult] = await Promise.all([
// //       model.aggregate(pagePipeline).exec(),
// //       model.aggregate(countPipeline).exec(),
// //     ]);

// //     const totalDocs = countResult[0]?.totalDocs ?? 0;
// //     const totalPages = Math.ceil(totalDocs / limit) || 1;
// //     const hasNextPage = page < totalPages;
// //     const hasPrevPage = page > 1;

// //     return {
// //       docs,
// //       totalDocs,
// //       limit,
// //       page,
// //       totalPages,
// //       hasNextPage,
// //       hasPrevPage,
// //       nextPage: hasNextPage ? page + 1 : null,
// //       prevPage: hasPrevPage ? page - 1 : null,
// //     };
// //   }
// // }


// // src/core/paginator.ts

// import type {
//   Document,
//   Model,
//   PopulateOptions,
//   QueryWithHelpers,
// } from "mongoose";
// import { PaginationDefaults } from "../config/types";
// import { PaginatedResult } from "./types";

// export type TransformFn<T, R> = (doc: T) => R;

// export interface QueryPaginationOptions<T extends Document> {
//   paginate?: boolean;
//   page?: number;
//   limit?: number;
//   sort?: any;
//   filter?: Record<string, any>;
//   projection?: any;
//   populate?: string | PopulateOptions | (string | PopulateOptions)[];
//   select?: string;
//   lean?: boolean;
//   transform?: TransformFn<T, any>;
// }

// export interface AggregatePaginationOptions {
//   paginate?: boolean;
//   page?: number;
//   limit?: number;
//   pipeline?: any[];
//   transform?: TransformFn<any, any>;
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

//   /**
//    * Paginate a standard Mongoose query.
//    * Supports an optional transform function to clean data (DTO).
//    */
//   async paginateQuery<T extends Document, R = T>(
//     model: Model<T>,
//     options: QueryPaginationOptions<T>,
//     // transform?: TransformFn<T, R>
//   ): Promise<PaginatedResult<R>> {
//     const { page, limit, skip } = this.normalize(options);
//     const filter = options.filter || {};

//     let query: QueryWithHelpers<any, T> = model
//       .find(filter, options.projection)
    
//     if (options.paginate !== false) {
//       query = query.skip(skip).limit(limit);
//     }  
//     if (options.sort) query = query.sort(options.sort);
//     if (options.populate) query = query.populate(options.populate as any);
//     if (options.select) query = query.select(options.select);
//     if (options.lean) query = query.lean();

//     const [docs, totalDocs] = await Promise.all([
//       query.exec(),
//       model.countDocuments(filter).exec(),
//     ]);

//     const totalPages = Math.ceil(totalDocs / limit) || 1;
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     // Apply transformation if provided
//     const resultDocs = options.transform ? docs.map(options.transform) : (docs as unknown as R[]);

//     return {
//       docs: resultDocs,
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

  
//   async paginateAggregate<T = any, R = T>(
//     model: Model<any>,
//     options: AggregatePaginationOptions,
//     // transform?: TransformFn<T, R>
//   ): Promise<PaginatedResult<R>> {
//     const { page, limit, skip } = this.normalize(options);
    
//     // Fallback to model's default pipeline if none provided
//     const basePipeline = options.pipeline ?? [];
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

//     // Apply transformation to the raw aggregate results
//     const resultDocs = options.transform ? docs.map(options.transform) : (docs as R[]);

//     return {
//       docs: resultDocs,
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

//   async paginateList<T = any, R = T>(
//     items: T[],
//     options: { page?: number; limit?: number; transform?: TransformFn<T, R>, sort?: any, paginate?: boolean }
//   ): Promise<PaginatedResult<R>> {
//     const { page, limit } = this.normalize(options);
//     const totalDocs = items.length;
//     const totalPages = Math.ceil(totalDocs / limit) || 1;
//     const hasNextPage = page < totalPages;
//     const hasPrevPage = page > 1;

//     // Apply transformation if provided
//     const resultDocs = options.transform ? items.map(options.transform) : (items as unknown as R[]);

//     return {
//       docs: resultDocs,
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
  paginate?: boolean;
  page?: number;
  limit?: number;
  sort?: any;
  filter?: Record<string, any>;
  projection?: any;
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  select?: string;
  lean?: boolean;
  transform?: TransformFn<T, any>;
}

export interface AggregatePaginationOptions {
  paginate?: boolean;
  page?: number;
  limit?: number;
  pipeline?: any[];
  transform?: TransformFn<any, any>;
}

export interface ListPaginationOptions<T, R> {
  paginate?: boolean;
  page?: number;
  limit?: number;
  transform?: TransformFn<T, R>;
}

export class Paginator {
  private paginationDefaults: Required<PaginationDefaults>;

  constructor(paginationDefaults: Required<PaginationDefaults>) {
    this.paginationDefaults = paginationDefaults;
  }

  /**
   * Internal helper to calculate page, limit, and skip
   */
  private normalize(options: { page?: number; limit?: number }) {
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

  /**
   * Helper to build consistent PaginatedResult metadata
   */
  private buildResult<R>(docs: R[], totalDocs: number, page: number, limit: number, isPaginated: boolean): PaginatedResult<R> {
    // If not paginated, the "limit" effectively becomes the total count
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

    const [docs, totalDocs] = await Promise.all([
      query.exec(),
      model.countDocuments(filter).exec(),
    ]);

    const resultDocs = options.transform ? docs.map(options.transform) : (docs as unknown as R[]);
    return this.buildResult(resultDocs, totalDocs, page, limit, isPaginated);
  }

  async paginateAggregate<T = any, R = T>(
    model: Model<any>,
    options: AggregatePaginationOptions
  ): Promise<PaginatedResult<R>> {
    const { page, limit, skip } = this.normalize(options);
    const isPaginated = options.paginate !== false;
    
    const basePipeline = options.pipeline ?? [];
    const countPipeline = [...basePipeline, { $count: "totalDocs" }];
    
    const pagePipeline = [...basePipeline];
    if (isPaginated) {
      pagePipeline.push({ $skip: skip }, { $limit: limit });
    }

    const [docs, countResult] = await Promise.all([
      model.aggregate(pagePipeline).exec(),
      model.aggregate(countPipeline).exec(),
    ]);

    const totalDocs = countResult[0]?.totalDocs ?? 0;
    const resultDocs = options.transform ? docs.map(options.transform) : (docs as R[]);
    
    return this.buildResult(resultDocs, totalDocs, page, limit, isPaginated);
  }

  /**
   * Paginate a simple Javascript Array
   */
  async paginateList<T = any, R = T>(
    items: T[],
    options: ListPaginationOptions<T, R>
  ): Promise<PaginatedResult<R>> {
    const { page, limit, skip } = this.normalize(options);
    const isPaginated = options.paginate !== false;
    
    const totalDocs = items.length;
    
    // Actually slice the array if pagination is requested
    const resultItems = isPaginated 
      ? items.slice(skip, skip + limit) 
      : items;

    const resultDocs = options.transform 
      ? resultItems.map(options.transform) 
      : (resultItems as unknown as R[]);

    return this.buildResult(resultDocs, totalDocs, page, limit, isPaginated);
  }
}