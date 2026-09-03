/**
 * Shared helpers for the service layer: id generation and keyset pagination.
 */

export function newId(prefix: string = "id"): string {
  // Browser-only path: crypto.randomUUID is widely supported.
  // TODO: Supabase: replace with `gen_random_uuid()` Postgres default.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------------------
// Keyset (cursor) pagination — Track A4.
//
// Cursor = base64(JSON{ createdAt, id }) over a stable (created_at DESC,
// id DESC) ordering. Keyset beats OFFSET because page N+1 stays O(1) as the
// table grows and rows can't be skipped/duplicated when inserts land between
// requests. Services expose `getPage(...)`; the old unpaginated getAll()s
// remain as deprecated wrappers during the migration.
// ---------------------------------------------------------------------------

export interface PageParams {
  /** Opaque cursor from the previous page's `nextCursor`; omit for page 1. */
  cursor?: string;
  /** Rows per page. Services clamp to a sane maximum. */
  limit: number;
}

export interface Page<T> {
  rows: T[];
  /** Pass into the next call; null when this is the last page. */
  nextCursor: string | null;
}

interface CursorPayload {
  createdAt: string;
  id: string;
}

export function encodeCursor(payload: CursorPayload): string {
  // btoa is available in browsers and Node 16+; escape unicode-safe via URI.
  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(cursor))) as CursorPayload;
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * PostgREST `.or()` filter string for "strictly after `cursor`" in
 * (created_at DESC, id DESC) order.
 */
export function keysetFilterDesc(c: CursorPayload): string {
  return `created_at.lt.${c.createdAt},and(created_at.eq.${c.createdAt},id.lt.${c.id})`;
}

/**
 * Shared post-processing: given `limit + 1` fetched rows, trim to `limit`
 * and derive `nextCursor` from the last kept row.
 */
export function toPage<T extends { id: string; createdAt: string }>(
  rows: T[],
  limit: number,
): Page<T> {
  const hasMore = rows.length > limit;
  const kept = hasMore ? rows.slice(0, limit) : rows;
  const last = kept[kept.length - 1];
  return {
    rows: kept,
    nextCursor:
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}
