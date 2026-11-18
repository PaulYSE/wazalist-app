import type {
  RequestContext,
} from "../types/request";

import {
  hashPassword,
} from "../auth";

import {
  err,
  json,
} from "../utils/responses";

/**
 * Handles self-service account API routes.
 *
 * @param ctx Shared request context.
 * @return A response when an account route matches, otherwise null.
 */
export async function handleAccountRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
    getUser,
  } = ctx;

  // ── Delete account ────────────────────────────────────────
  if (
    path === "/api/account" &&
    request.method === "DELETE"
  ) {
    const user = await getUser();

    if (!user) {
      return err("Authentication required", 401);
    }

    // Require password re-entry. This is irreversible.
    const { password } =
      await request.json().catch(() => ({}));

    if (!password) {
      return err(
        "Password confirmation is required",
      );
    }

    const row = await env.DB.prepare(
      "SELECT password_hash FROM users WHERE id = ?",
    )
      .bind(user.id)
      .first();

    const [salt, storedHash] =
      (row!.password_hash as string).split(":");

    const { hash } =
      await hashPassword(password, salt);

    if (hash !== storedHash) {
      return err("Incorrect password", 401);
    }

    // Block deletion if sole admin of any group.
    const soloGroupAdmin = await env.DB.prepare(`
      SELECT g.name
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      WHERE gm.user_id = ?
        AND gm.role = 'admin'
        AND (
          SELECT COUNT(*)
          FROM group_members gm2
          WHERE gm2.group_id = gm.group_id
            AND gm2.role = 'admin'
        ) = 1
      LIMIT 1
    `)
      .bind(user.id)
      .first();

    if (soloGroupAdmin) {
      return err(
        `You are the only admin of "${soloGroupAdmin.name}". Promote another member or delete the group before deleting your account.`,
        409,
      );
    }

    // Do not allow the last application admin to delete itself.
    if (user.is_admin) {
      const adminCount = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE is_admin = 1",
      ).first();

      if (
        ((adminCount?.n as number) ?? 0) <= 1
      ) {
        return err(
          "Cannot delete the only admin account. Promote another admin first.",
          409,
        );
      }
    }

    try {
      await env.DB.batch([
        env.DB.prepare(
          "DELETE FROM sessions WHERE user_id = ?",
        ).bind(user.id),

        env.DB.prepare(
          "DELETE FROM progress WHERE user_id = ?",
        ).bind(user.id),

        env.DB.prepare(
          "DELETE FROM contributions WHERE user_id = ?",
        ).bind(user.id),

        env.DB.prepare(
          "DELETE FROM group_members WHERE user_id = ?",
        ).bind(user.id),

        env.DB.prepare(
          "DELETE FROM group_applications WHERE user_id = ?",
        ).bind(user.id),

        env.DB.prepare(
          "DELETE FROM users WHERE id = ?",
        ).bind(user.id),
      ]);

      return json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (message.includes("GROUP_LAST_ADMIN")) {
        return err(
          "Account deletion was cancelled because you are now the only admin of a group. Promote another member or delete the group, then try again.",
          409,
        );
      }

      console.error(
        "Account deletion failed:",
        error,
      );

      return err(
        "Could not delete your account. Please refresh to verify your account state before retrying.",
        500,
      );
    }
  }

  // ── Change username ────────────────────────────────────────
if (
  path === "/api/account/username" &&
  request.method === "POST"
) {
  const user = await getUser();

  if (!user) {
    return err("Authentication required", 401);
  }

  const { username, password } =
    await request.json().catch(() => ({}));

  if (!password) {
    return err("Current password is required");
  }

  if (typeof username !== "string") {
    return err("Username is required");
  }

  const trimmed = username.trim();

  // Length is counted in Unicode code points rather than
  // JavaScript UTF-16 code units.
  const len = [...trimmed].length;

  if (len < 3 || len > 32) {
    return err(
      "Username must be 3–32 characters",
    );
  }

  const row = await env.DB.prepare(
    "SELECT password_hash FROM users WHERE id = ?",
  )
    .bind(user.id)
    .first();

  const [salt, storedHash] =
    (row!.password_hash as string).split(":");

  const { hash } =
    await hashPassword(password, salt);

  if (hash !== storedHash) {
    return err("Incorrect password", 401);
  }

  if (trimmed === user.username) {
    return err(
      "That is already your username",
    );
  }

  try {
    await env.DB.prepare(
      "UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(trimmed, user.id)
      .run();
  } catch {
    return err(
      "That username is already taken",
      409,
    );
  }

  return json({
    success: true,
    username: trimmed,
  });
}

  // ── Change password ────────────────────────────────────────
if (
  path === "/api/account/password" &&
  request.method === "POST"
) {
  const user = await getUser();

  if (!user) {
    return err("Authentication required", 401);
  }

  const { current, next } =
    await request.json().catch(() => ({}));

  if (!current || !next) {
    return err(
      "Current and new passwords are required",
    );
  }

  const row = await env.DB.prepare(
    "SELECT password_hash FROM users WHERE id = ?",
  )
    .bind(user.id)
    .first();

  const [salt, storedHash] =
    (row!.password_hash as string).split(":");

  const { hash } =
    await hashPassword(current, salt);

  if (hash !== storedHash) {
    return err(
      "Incorrect current password",
      401,
    );
  }

  const {
    hash: newHash,
    salt: newSalt,
  } = await hashPassword(next);

  await env.DB.prepare(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(
      `${newSalt}:${newHash}`,
      user.id,
    )
    .run();

  await env.DB.prepare(
    "DELETE FROM sessions WHERE user_id = ?",
  )
    .bind(user.id)
    .run();

  return json({ success: true });
}

  return null;
}
