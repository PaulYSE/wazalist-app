import type {
  RequestContext,
} from "../types/request";

import {
  parseStoredLabels,
} from "../utils/labels";

import {
  err,
  json,
} from "../utils/responses";

/**
 * Handles marking-label API routes.
 *
 * @param ctx Shared request context.
 * @return A response when a marking-label route matches, otherwise null.
 */
export async function handleLabelRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
    getUser,
  } = ctx;

  // ── Get marking labels ────────────────────────────────────
  if (
    path === "/api/labels" &&
    request.method === "GET"
  ) {
    const user = await getUser();

    if (!user) {
      return err("Authentication required", 401);
    }

    const row = await env.DB.prepare(
      "SELECT shape_labels FROM users WHERE id = ?",
    )
      .bind(user.id)
      .first();

    const labels = parseStoredLabels(
      row?.shape_labels,
    );

    return json({ labels });
  }

  return null;
}
