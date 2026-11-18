import type {
  RequestContext,
} from "../types/request";

import {
  hashPassword,
} from "../auth";

import {
  ValidationError,
} from "../validation";

import {
  readJsonObject,
} from "../utils/request";

import {
  err,
  json,
} from "../utils/responses";

/**
 * Handles application-admin API routes.
 *
 * @param ctx Shared request context.
 * @return A response when an admin route matches, otherwise null.
 */
export async function handleAdminRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
    getUser,
  } = ctx;

  // ── Force-reset user password ─────────────────────────────
  if (
    path === "/api/admin/reset-password" &&
    request.method === "POST"
  ) {
    const caller = await getUser();

    if (!caller || !caller.is_admin) {
      return err("Forbidden", 403);
    }

    let body: Record<string, unknown>;

    try {
      body = await readJsonObject(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      throw error;
    }

    const {
      username,
      new_password,
    } = body;

    if (
      typeof username !== "string" ||
      typeof new_password !== "string" ||
      !username ||
      !new_password
    ) {
      return err(
        "username and new_password are required",
      );
    }

    const target = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ?",
    )
      .bind(username)
      .first();

    if (!target) {
      return err("User not found", 404);
    }

    const {
      hash,
      salt,
    } = await hashPassword(new_password);

    await env.DB.batch([
      env.DB.prepare(
        "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      ).bind(
        `${salt}:${hash}`,
        target.id as number,
      ),

      env.DB.prepare(
        "DELETE FROM sessions WHERE user_id = ?",
      ).bind(target.id as number),
    ]);

    return json({
      success: true,
      message:
        "Password reset. All existing sessions invalidated.",
    });
  }

  return null;
}
