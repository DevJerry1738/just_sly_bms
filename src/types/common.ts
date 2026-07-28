// Shared cross-feature domain primitives.
// Feature-specific types live in each feature folder.

export interface PaginatedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, string | number | boolean | null>;
}

export interface AuditableEntity {
  id: string;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
}

export type LoadState = "idle" | "loading" | "error" | "success";
