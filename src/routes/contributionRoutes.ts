import type {
  RequestContext,
} from "../types/request";

import {
  ValidationError,
  readContributionBody,
  validateWazaPayload,
} from "../validation";

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

  // ── Submit contribution ────────────────────────────────────
if (
  path === "/api/contributions" &&
  request.method === "POST"
) {
  const user = await getUser();

  if (!user) {
    return err("Authentication required", 401);
  }

  let body: Record<string, unknown>;
  let payload: Record<string, string>;

  try {
    body = await readContributionBody(request);

    if (
      body.type !== "edit" &&
      body.type !== "new_waza"
    ) {
      throw new ValidationError("Invalid type");
    }

    if (
      body.type === "edit" &&
      !body.waza_id
    ) {
      throw new ValidationError(
        "waza_id required for edits",
      );
    }

    payload = validateWazaPayload(
      body.payload,
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return err(error.message, 400);
    }

    throw error;
  }

  await env.DB.prepare(`
    INSERT INTO contributions
      (user_id, type, waza_id, payload, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `)
    .bind(
      user.id,
      body.type,
      body.waza_id ?? null,
      JSON.stringify(payload),
    )
    .run();

  return json({ success: true });
}

  return null;
}
