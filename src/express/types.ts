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
  page?: number;
  limit?: number;
  [key: string]: any;
}

export interface QueryOptions<T = any, R = any> extends ListOptions<T, R> {
  filter?: any;
  sort?: any;
  projection?: any;
  populate?: any;
}
export interface AggregateOptions<T = any, R = any> extends ListOptions<T, R> {
  pipeline: any[]; // Required for aggregate
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

    success: <T, R = T>(
      data: T,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    created: <T, R = T>(
      data: T,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    updated: <T, R = T>(
      data?: T | null,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;

    deleted: (data?: any, message?: string) => void;

    // error: (err: unknown, options?: { silent?: boolean }) => void;


    //------------- Paginated Methods ----------------

    list: <T, R = T>(
      data: T[],
      options: ListOptions<T, R>,
      message?: string
    ) => Promise<void>;

    paginateQuery: <T, R = T>(
      model: any,
      options: QueryOptions<T, R>,
      message?: string
    ) => Promise<void>;

    paginateAggregate: <T, R = T>(
      model: any,
      options: AggregateOptions<T, R>,
      message?: string
    ) => Promise<void>;
  }
}

export {};
