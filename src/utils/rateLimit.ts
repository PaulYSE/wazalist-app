/**
 * Generic D1-backed rate-limit helper.
 *
 * Counts rows belonging to a specific user within a sliding
 * SQLite datetime() window.
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
