/**
 * rateLimit.ts — Generic D1-backed rate-limit helper.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Returns whether a user has reached a per-window limit.
 *
 * @remarks
 * Counts rows in `table` belonging to `userId` whose `timeCol` falls within
 * a sliding SQLite `datetime('now', ?)` window, and reports whether that
 * count is greater than or equal to `limit`.
 *
 * `table`, `userCol`, and `timeCol` are interpolated directly into the SQL
 * string — callers must pass trusted identifiers, never user input.
 *
 * @param db - D1 database binding.
 * @param table - Table to count rows in.
 * @param userCol - Column holding the user ID.
 * @param timeCol - Column holding the event timestamp.
 * @param userId - User to check.
 * @param limit - Maximum number of events allowed in the window.
 * @param window - SQLite datetime modifier for the window start (e.g.
 *   `'-1 hour'`).
 * @returns `true` if the count is at or above `limit`, otherwise `false`.
 */
export async function isRateLimited(
  db: D1Database,
  table: string,
  userCol: string,
  timeCol: string,
  userId: number,
  limit: number,
  window: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM ${table}
       WHERE ${userCol} = ?
       AND ${timeCol} >= datetime('now', ?)`,
    )
    .bind(userId, window)
    .first<{ n: number }>();

  return (row?.n ?? 0) >= limit;
}
