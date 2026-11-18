import type {
  RequestContext,
} from "../types/request";

import {
  err,
  json,
} from "../utils/responses";

/**
 * Handles member contribution API routes.
 *
 * @param ctx Shared request context.
 * @return A response when a contribution route matches, otherwise null.
 */
export async function handleContributionRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
    getUser,
  } = ctx;

  // ── Get current user's contributions ─────────────────────
  if (
    path === "/api/contributions/mine" &&
    request.method === "GET"
  ) {
    const user = await getUser();

    if (!user) {
      return err("Authentication required", 401);
    }

    const { results } = await env.DB.prepare(`
      SELECT
        c.*,
        w.name_jp AS waza_name_jp
      FROM contributions c
      LEFT JOIN waza w ON c.waza_id = w.id
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `)
      .bind(user.id)
      .all();

    return json(results);
  }

  return null;
}
