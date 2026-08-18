import { format, isValid } from "date-fns";

/**
 * A safe wrapper around date-fns `format` that never throws.
 *
 * - Accepts a Unix timestamp (ms), Date object, or any value.
 * - Returns `fallback` (default "—") if the value is null, undefined, 0, NaN,
 *   or produces an invalid Date.
 *
 * Usage:
 *   formatSafe(record.timestamp, "dd MMM yyyy HH:mm")
 *   formatSafe(record.createdAt, "HH:mm:ss", "N/A")
 */
export function formatSafe(
  value: number | string | Date | null | undefined,
  pattern: string,
  fallback = "—"
): string {
  try {
    if (value === null || value === undefined || value === 0 || value === "") {
      return fallback;
    }
    const d = value instanceof Date ? value : new Date(value as number);
    if (!isValid(d)) return fallback;
    return format(d, pattern);
  } catch {
    return fallback;
  }
}
