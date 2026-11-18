import type {
  RequestContext,
} from "../types/request";

import {
  hashPassword,
} from "../auth";
import {
  ValidationError,
  readContributionBody,
  validateWazaPayload,
} from "../validation";

import {
  readJsonObject,
} from "../utils/request";

import {
  err,
  json,
} from "../utils/responses";

import {
  renderAdmin,
} from "../renderAdmin";

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
  url,
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

// ── Render admin panel ─────────────────────────────────────
if (path === "/admin") {
  const user = await getUser();

  if (!user || !user.is_admin) {
    return new Response(
      "Forbidden",
      {
        status: 403,
      },
    );
  }

  const html =
    await renderAdmin(env, request);

  return new Response(
    html,
    {
      headers: {
        "Content-Type": "text/html",
      },
    },
  );
}

  // ── List contributions for review ──────────────────────────
if (
  path === "/api/admin/contributions" &&
  request.method === "GET"
) {
  const user = await getUser();

  if (!user || !user.is_admin) {
    return err("Forbidden", 403);
  }

  const status =
    url.searchParams.get("status") || "pending";

  const { results } = await env.DB.prepare(`
    SELECT
      c.*,
      u.username,
      w.name_jp AS waza_name_jp
    FROM contributions c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN waza w ON c.waza_id = w.id
    WHERE c.status = ?
    ORDER BY c.created_at ASC
  `)
    .bind(status)
    .all();

  return json(results);
}

  // ── Get Waza for admin review ──────────────────────────────
if (
  path.startsWith("/api/admin/waza/") &&
  request.method === "GET"
) {
  const user = await getUser();

  if (!user || !user.is_admin) {
    return err("Forbidden", 403);
  }

  const id = path.split("/").pop();

  const waza = await env.DB.prepare(
    "SELECT * FROM waza WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!waza) {
    return err("Waza not found", 404);
  }

  return json(waza);
}

  // ── Approve contribution ───────────────────────────────────
if (
  path.match(
    /^\/api\/admin\/contributions\/\d+\/approve$/,
  ) &&
  request.method === "POST"
) {
  const user = await getUser();

  if (!user || !user.is_admin) {
    return err("Forbidden", 403);
  }

  const id = path.split("/")[4];

  let body: Record<string, unknown>;

  try {
    body = await readContributionBody(request);
  } catch (error) {
    if (error instanceof ValidationError) {
      return err(error.message, 400);
    }

    throw error;
  }

  const contrib = await env.DB.prepare(
    "SELECT * FROM contributions WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!contrib) {
    return err("Not found", 404);
  }

  if (contrib.status !== "pending") {
    return err("Already reviewed");
  }

  if (
    contrib.type !== "edit" &&
    contrib.type !== "new_waza"
  ) {
    return err(
      "Invalid stored contribution type",
      400,
    );
  }

  let payload: Record<string, string>;

  try {
    let candidate: unknown = body.payload;

    if (
      candidate === undefined ||
      candidate === null
    ) {
      try {
        candidate = JSON.parse(
          contrib.payload as string,
        );
      } catch {
        throw new ValidationError(
          "Stored contribution payload is invalid JSON",
        );
      }
    }

    payload = validateWazaPayload(candidate);
  } catch (error) {
    if (error instanceof ValidationError) {
      return err(error.message, 400);
    }

    throw error;
  }

  const keys = Object.keys(payload);
  const values = keys.map(
    (key) => payload[key],
  );

  if (contrib.type === "edit") {
    const setClause = keys
      .map((key) => `"${key}" = ?`)
      .join(", ");

    await env.DB.prepare(
      `UPDATE waza SET ${setClause} WHERE id = ?`,
    )
      .bind(...values, contrib.waza_id)
      .run();
  } else {
    const columns = keys
      .map((key) => `"${key}"`)
      .join(", ");

    const placeholders = keys
      .map(() => "?")
      .join(", ");

    await env.DB.prepare(
      `INSERT INTO waza (${columns}) VALUES (${placeholders})`,
    )
      .bind(...values)
      .run();
  }

  await env.DB.prepare(`
    UPDATE contributions
    SET status = 'approved',
        reviewed_at = datetime('now'),
        admin_note = ?
    WHERE id = ?
  `)
    .bind(
      body.note ?? null,
      id,
    )
    .run();

  return json({ success: true });
}

  // ── Reject contribution ────────────────────────────────────
if (
  path.match(
    /^\/api\/admin\/contributions\/\d+\/reject$/,
  ) &&
  request.method === "POST"
) {
  const user = await getUser();

  if (!user || !user.is_admin) {
    return err("Forbidden", 403);
  }

  const id = path.split("/")[4];

  let body: Record<string, unknown>;

  try {
    body = await readJsonObject(request);
  } catch (error) {
    if (error instanceof ValidationError) {
      return err(error.message, 400);
    }

    throw error;
  }

  const { note } = body;

  if (
    note !== undefined &&
    note !== null &&
    typeof note !== "string"
  ) {
    return err(
      "note must be a string or null",
    );
  }

  if (
    typeof note === "string" &&
    note.length > 2000
  ) {
    return err(
      "note must not exceed 2000 characters",
    );
  }

  const contrib = await env.DB.prepare(
    "SELECT id, status FROM contributions WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!contrib) {
    return err("Not found", 404);
  }

  if (contrib.status !== "pending") {
    return err("Already reviewed");
  }

  await env.DB.prepare(`
    UPDATE contributions
    SET status = 'rejected',
        reviewed_at = datetime('now'),
        admin_note = ?
    WHERE id = ?
  `)
    .bind(
      note ?? null,
      id,
    )
    .run();

  return json({ success: true });
}

  return null;
}
