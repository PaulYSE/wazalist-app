import type {
  RequestContext,
} from "../types/request";

import {
  json,
} from "../utils/responses";

/**
 * Handles group API routes.
 *
 * @param ctx Shared request context.
 * @return A response when a group route matches, otherwise null.
 */
export async function handleGroupRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
  } = ctx;

  // ── List groups ───────────────────────────────────────────
  if (
    path === "/api/groups" &&
    request.method === "GET"
  ) {
    const { results } = await env.DB.prepare(`
      SELECT
        g.id,
        g.name,
        g.join_policy,
        g.social,
        g.created_at,
        COUNT(gm.user_id) AS member_count
      FROM groups g
      LEFT JOIN group_members gm
        ON gm.group_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `).all();

    return json(results);
  }

  return null;
}
