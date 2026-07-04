import { AppError } from "./errors";

export interface ErrorDetails {
  message: string;
  code?: string;
  field?: string;
  value?: any;
  errors?: ErrorDetails[];
}

export interface PaginatedResult<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextPage: number | null;
  prevPage: number | null;
}

export interface CursorPaginatedResult<T> {
  docs: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}

export type ErrorAdapter = (err: unknown) => AppError | null;
