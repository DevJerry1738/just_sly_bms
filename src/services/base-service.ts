import { supabase } from "@/integrations/supabase/client";
import type { ListQuery, PaginatedResult } from "@/types/common";

/**
 * Thin data-access layer. UI components never talk to the database directly —
 * feature services compose these helpers instead.
 */

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function toServiceError(error: { message: string; code?: string } | null): never {
  throw new ServiceError(error?.message ?? "Unexpected error", error?.code);
}

export function paginationRange(page = 1, pageSize = 10): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

export function emptyPage<T>(query: ListQuery = {}): PaginatedResult<T> {
  return { rows: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 10 };
}

/** Exposed for feature services once their tables exist. */
export const db = supabase;
