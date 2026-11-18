/**
 * wazaRoutes.ts — Route handler for public Waza API endpoints.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { RequestContext } from '../types/request';

import { json } from '../utils/responses';

/**
 * Handles public Waza API routes.
 *
 * @remarks
 * Currently matches `GET /api/waza`. Returns every row in `waza` together
 * with aggregated `like_count` and `dislike_count` values derived from the
 * `progress` table. Returns `null` for any unmatched path or method so the
 * caller can continue route dispatch.
 *
 * @param ctx - Shared request context.
 * @returns A response when a Waza route matches, otherwise `null`.
 */
export async function handleWazaRoutes(ctx: RequestContext): Promise<Response | null> {
  const { request, env, path } = ctx;

  // ── Waza ──────────────────────────────────────────────────
  if (path === '/api/waza' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `
      SELECT
        w.*,
        COALESCE(
          SUM(CASE WHEN p.like = 1 THEN 1 END),
          0
        ) AS like_count,
        COALESCE(
          SUM(CASE WHEN p.like = -1 THEN 1 END),
          0
        ) AS dislike_count
      FROM waza w
      LEFT JOIN progress p ON p.waza_id = w.id
      GROUP BY w.id
    `,
    ).all();

    return json(results);
  }

  return null;
}
