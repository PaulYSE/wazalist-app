import type {
  RequestContext,
} from "../types/request";

import {
  parseStoredMarkings,
} from "../utils/markings";

import {
  json,
} from "../utils/responses";

/**
 * Handles progress API routes.
 *
 * @param ctx Shared request context.
 * @return A response when a progress route matches, otherwise null.
 */
export async function handleProgressRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
    getUser,
  } = ctx;

  // ── Get progress ───────────────────────────────────────────
  if (
    path === "/api/progress" &&
    request.method === "GET"
  ) {
    const user = await getUser();

    if (!user) {
      return json([]);
    }

    const { results } = await env.DB.prepare(
      "SELECT * FROM progress WHERE user_id = ?",
    )
      .bind(user.id)
      .all();

    const normalizedResults = results.map((row) => ({
      ...row,
      markings: JSON.stringify(
        parseStoredMarkings(row.markings),
      ),
    }));

    return json(normalizedResults);
  }

  return null;
}
