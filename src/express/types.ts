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

import { PaginatedResult } from "../core/types";
import { TransformFn } from "../core/paginator";

export interface ResponseOptions<T, R> {
  transform?: TransformFn<T, R>;
  silent?: boolean;
}

declare module "express-serve-static-core" {
  interface Response {
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
      data?: T,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;
    deleted: (message?: string, options?: { silent?: boolean }) => void;
    list: <T, R = T>(
      items: T[],
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;
    paginated: <T, R = T>(
      result: PaginatedResult<T>,
      message?: string,
      options?: ResponseOptions<T, R>
    ) => void;
    error: (err: unknown, options?: { silent?: boolean }) => void;

    // Helpers
    paginateQuery: <T, R = T>(
      model: any,
      options: any,
      message?: string,
      transform?: TransformFn<T, R>
    ) => Promise<void>;

    paginateAggregate: <T, R = T>(
      model: any,
      options: any,
      message?: string,
      transform?: TransformFn<T, R>
    ) => Promise<void>;
  }
}

export {};
