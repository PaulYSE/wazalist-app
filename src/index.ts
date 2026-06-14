/**
 * @file index.ts (Cloudflare Worker)
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Main Cloudflare Worker entry point. Handles all API routes for authentication, waza data, progress tracking, labels, list sharing (KV), account management, contributions, admin panel, and serves the HTML frontend.
 */

import { renderHtml } from "./renderHtml";
import { renderAdmin } from "./renderAdmin";
import { hashPassword, generateToken, getUserFromSession } from "./auth";

/**
 * @brief Helper to return JSON response.
 *
 * @param {unknown} data - Data to stringify.
 * @param {number} status - HTTP status code (default 200).
 * @return {Response} JSON response.
 */
const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

/**
 * @brief Helper to return error JSON response.
 *
 * @param {string} msg - Error message.
 * @param {number} status - HTTP status code (default 400).
 * @return {Response} JSON error response.
 */
const err = (msg: string, status = 400) => json({ error: msg }, status);

export default {
	async fetch(request, env) {
		let url: URL;
		try {
			url = new URL(request.url);
		} catch {
			console.error("Bad request.url:", JSON.stringify(request.url), "referer:", request.headers.get("referer"));
			return new Response("Bad Request", { status: 400 });
		}
		const path = url.pathname;

		// ── Auth helpers ──────────────────────────────────────────
		const authHeader = request.headers.get("Authorization");
		const sessionToken = authHeader?.replace("Bearer ", "") || "";
		const getUser = () =>
			sessionToken ? getUserFromSession(env, sessionToken) : null;

		// ── Group role helper ─────────────────────────────────────────
		const getGroupRole = async (groupId: number, userId: number): Promise<string | null> => {
		const row = await env.DB.prepare(
			"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
		).bind(groupId, userId).first();
		return row ? (row.role as string) : null;
		};

		// ── Say no to robots ──────────────────────────────────────
		if (path === "/robots.txt") {
			return new Response("User-agent: *\nDisallow: /", {
				headers: { "Content-Type": "text/plain" },
			});
		}
		
		// ── Waza ──────────────────────────────────────────────────
		if (path === "/api/waza") {
			const { results } = await env.DB.prepare(`
				SELECT
					w.*,
					COALESCE(SUM(CASE WHEN p.like = 1 THEN 1 END), 0) AS like_count,
					COALESCE(SUM(CASE WHEN p.like = -1 THEN 1 END), 0) AS dislike_count
				FROM waza w
				LEFT JOIN progress p ON p.waza_id = w.id
				GROUP BY w.id
			`).all();
			return json(results);
		}

		// ── Login ─────────────────────────────────────────────────
		if (path === "/api/login" && request.method === "POST") {
			const { username, password } = await request.json();
			if (!username || !password)
				return err("Username and password are required");

			const user = await env.DB.prepare(
				"SELECT id, username, password_hash, is_admin FROM users WHERE username = ?"
			)
				.bind(username)
				.first();
			if (!user) return err("Invalid username or password", 401);

			const [salt, storedHash] = (user.password_hash as string).split(":");
			const { hash } = await hashPassword(password, salt);
			if (hash !== storedHash) return err("Invalid username or password", 401);

			const token = generateToken();
			const expiresAt = new Date(
				Date.now() + 30 * 24 * 60 * 60 * 1000
			).toISOString();
			await env.DB.prepare(
				"INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)"
			)
				.bind(token, user.id, expiresAt)
				.run();

			return json({
				success: true,
				token,
				user: { id: user.id, username: user.username, is_admin: user.is_admin },
			});
		}

		// ── Register ──────────────────────────────────────────────
		if (path === "/api/register" && request.method === "POST") {
			const { username, email, password } = await request.json();
			if (!username || !password)
				return err("Username and password are required");

			const existing = await env.DB.prepare(
				"SELECT id FROM users WHERE username = ?"
			)
				.bind(username)
				.first();
			if (existing) return err("User already exists");

			const { hash, salt } = await hashPassword(password);
			const result = await env.DB.prepare(
				"INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)"
			)
				.bind(username, email || null, `${salt}:${hash}`)
				.run();

			return json({ success: true, user: { id: result.meta.last_row_id, username } });
		}

		// ── Current user (re-hydrate session on refresh) ──────────
		if (path === "/api/me" && request.method === "GET") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);
			return json({ user });
		}

		// ── Progress ──────────────────────────────────────────────
		if (path === "/api/progress") {
			const user = await getUser();

			if (request.method === "GET") {
				if (user) {
					const { results } = await env.DB.prepare(
						"SELECT * FROM progress WHERE user_id = ?"
					)
						.bind(user.id)
						.all();
					return json(results);
				}
				return json([]);
			}

			if (request.method === "POST") {
				if (!user) return err("Authentication required", 401);
				const { waza_id, markings, like } = await request.json();
				if (!waza_id) return err("waza_id is required");

				// Validate like value: must be null, 1, or -1
				if (like !== null && like !== 1 && like !== -1) {
					return err("Invalid like value: must be null, 1, or -1");
				}

				// `like` is an account-only field — guests must not reach this,
				// but strip it defensively if no authenticated session exists.
				const likeValue = user ? (like ?? null) : null;

				await env.DB.prepare(`
					INSERT INTO progress (user_id, waza_id, markings, like, updated_at)
					VALUES (?, ?, ?, ?, datetime('now'))
					ON CONFLICT (user_id, waza_id) DO UPDATE SET
						markings = excluded.markings,
						like = excluded.like,
						updated_at = datetime('now')
				`)
					.bind(user.id, waza_id, markings ?? "[]", likeValue)
					.run();

				// Return fresh aggregate counts for this waza so the frontend
				// can update the displayed like_count/dislike_count immediately.
				const counts = await env.DB.prepare(`
					SELECT
						COALESCE(SUM(CASE WHEN like = 1 THEN 1 END), 0) AS like_count,
						COALESCE(SUM(CASE WHEN like = -1 THEN 1 END), 0) AS dislike_count
					FROM progress
					WHERE waza_id = ?
				`).bind(waza_id).first();

				return json({ success: true, waza_id, ...counts });
			}

			// Allow users to wipe their progress for a waza by removing their progress history
			if (request.method === "DELETE") {
				const user = await getUser();
				if (!user) return err("Authentication required", 401);

				await env.DB.prepare(
					"DELETE FROM progress WHERE user_id = ?"
				).bind(user.id).run();

				return json({ success: true });
			}
		}

		// ── Shape labels ──────────────────────────────────────────

		// GET /api/labels
		if (path === "/api/labels" && request.method === "GET") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const row = await env.DB.prepare(
				"SELECT shape_labels FROM users WHERE id = ?"
			).bind(user.id).first();

			const labels = row?.shape_labels ?? '["","","","","",""]';
			return json({ labels: JSON.parse(labels as string) });
		}

		// POST /api/labels
		if (path === "/api/labels" && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const { labels } = await request.json();
			if (!Array.isArray(labels) || labels.length !== 6)
				return err("labels must be an array of 6 strings");

			await env.DB.prepare(
				"UPDATE users SET shape_labels = ? WHERE id = ?"
			).bind(JSON.stringify(labels), user.id).run();

			return json({ success: true });
		}

		// ── List share (KV) ──────────────────────────────────────

		// POST /api/list — store serialized list, keyed by SHA-256 hash
		if (path === "/api/list" && request.method === "POST") {
			const { key, data } = await request.json();
			if (!/^[0-9a-f]{64}$/.test(key)) return err("Invalid key format");
			if (typeof data !== "string" || data.length > 524288) return err("Payload too large or invalid");
			try { JSON.parse(data); } catch { return err("Payload must be valid JSON"); }
			await env.LIST_STORE.put(key, data, { expirationTtl: 60 * 60 * 24 * 90 });
			return json({ success: true, key });
		}

		// GET /api/list?key=... — retrieve serialized list
		if (path === "/api/list" && request.method === "GET") {
			const key = url.searchParams.get("key") || "";
			if (!/^[0-9a-f]{64}$/.test(key)) return err("Invalid key format");
			const data = await env.LIST_STORE.get(key);
			if (data === null) return err("List not found or expired", 404);
			return json({ data });
		}

		// ── Delete account ────────────────────────────────────────

		// DELETE /api/account — self-service account deletion
		if (path === "/api/account" && request.method === "DELETE") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			// Require password re-entry — this is irreversible.
			const { password } = await request.json().catch(() => ({}));
			if (!password) return err("Password confirmation is required");

			const row = await env.DB.prepare(
				"SELECT password_hash FROM users WHERE id = ?"
			).bind(user.id).first();
			const [salt, storedHash] = (row!.password_hash as string).split(":");
			const { hash } = await hashPassword(password, salt);
			if (hash !== storedHash) return err("Incorrect password", 401);

			// Block deletion if sole admin of any group
			const soloGroupAdmin = await env.DB.prepare(`
				SELECT g.name
				FROM group_members gm
				JOIN groups g ON g.id = gm.group_id
				WHERE gm.user_id = ? AND gm.role = 'admin'
					AND (
					SELECT COUNT(*) FROM group_members gm2
					WHERE gm2.group_id = gm.group_id AND gm2.role = 'admin'
					) = 1
				LIMIT 1
			`).bind(user.id).first();

			if (soloGroupAdmin) {
				return err(
					`You are the only admin of "${soloGroupAdmin.name}". Promote another member or delete the group before deleting your account.`,
					409
				);
			}

			// Don't let the last admin delete themselves and lock out /admin.
			if (user.is_admin) {
				const a = await env.DB.prepare(
					"SELECT COUNT(*) AS n FROM users WHERE is_admin = 1"
				).first();
				if (((a?.n as number) ?? 0) <= 1)
					return err("Cannot delete the only admin account. Promote another admin first.", 409);
			}

			// Delete child rows first, then the user — in one atomic batch.
			// FK cascade can't be relied on (enforcement is off by default, and
			// progress/contributions have no ON DELETE rule anyway).
			await env.DB.batch([
				env.DB.prepare("DELETE FROM sessions      WHERE user_id = ?").bind(user.id),
				env.DB.prepare("DELETE FROM progress      WHERE user_id = ?").bind(user.id),
				env.DB.prepare("DELETE FROM contributions WHERE user_id = ?").bind(user.id),
				env.DB.prepare("DELETE FROM users         WHERE id      = ?").bind(user.id),
			]);

			return json({ success: true });
		}

		// POST /api/account/username — change username (requires current password)
		if (path === "/api/account/username" && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const { username, password } = await request.json().catch(() => ({}));
			if (!password) return err("Current password is required");
			if (typeof username !== "string") return err("Username is required");

			const trimmed = username.trim();
			// Length is counted in code points (UTF-8 aware), not UTF-16 units,
			// so multi-byte characters count as one each.
			const len = [...trimmed].length;
			if (len < 3 || len > 32) return err("Username must be 3–32 characters");

			// Verify current password.
			const row = await env.DB.prepare(
				"SELECT password_hash FROM users WHERE id = ?"
			).bind(user.id).first();
			const [salt, storedHash] = (row!.password_hash as string).split(":");
			const { hash } = await hashPassword(password, salt);
			if (hash !== storedHash) return err("Incorrect password", 401);

			// No-op if unchanged (case-sensitive compare).
			if (trimmed === user.username) return err("That is already your username");

			// Attempt the rename. The UNIQUE constraint on username makes this
			// race-safe: a duplicate fails here rather than needing a pre-check.
			try {
				await env.DB.prepare(
					"UPDATE users SET username = ?, updated_at = datetime('now') WHERE id = ?"
				).bind(trimmed, user.id).run();
			} catch {
				// UNIQUE violation (or other constraint failure) → name taken.
				return err("That username is already taken", 409);
			}

			return json({ success: true, username: trimmed });
		}

		// POST /api/account/password — change password (requires current password)
		if (path === "/api/account/password" && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const { current, next } = await request.json().catch(() => ({}));
			if (!current || !next) return err("Current and new passwords are required");

			// Verify current password.
			const row = await env.DB.prepare(
				"SELECT password_hash FROM users WHERE id = ?"
			).bind(user.id).first();
			const [salt, storedHash] = (row!.password_hash as string).split(":");
			const { hash } = await hashPassword(current, salt);
			if (hash !== storedHash) return err("Incorrect current password", 401);

			// Hash the new password with a fresh salt, store it.
			const { hash: newHash, salt: newSalt } = await hashPassword(next);
			await env.DB.prepare(
				"UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"
			).bind(`${newSalt}:${newHash}`, user.id).run();

			// Invalidate ALL sessions — the user must log in again with the new password.
			await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?")
				.bind(user.id)
				.run();

			return json({ success: true });
		}

		// ── Contributions ─────────────────────────────────────────

		// GET /api/contributions/mine
		if (path === "/api/contributions/mine" && request.method === "GET") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const { results } = await env.DB.prepare(`
				SELECT c.*, w.name_jp as waza_name_jp
				FROM contributions c
				LEFT JOIN waza w ON c.waza_id = w.id
				WHERE c.user_id = ?
				ORDER BY c.created_at DESC
			`)
				.bind(user.id)
				.all();
			return json(results);
		}

		// POST /api/contributions
		if (path === "/api/contributions" && request.method === "POST") {
			const user = await getUser();
			if (!user) return err("Authentication required", 401);

			const body = await request.json();
			const { type, waza_id, payload } = body;

			if (!type || !payload) return err("type and payload are required");
			if (type !== "edit" && type !== "new_waza") return err("Invalid type");
			if (type === "edit" && !waza_id) return err("waza_id required for edits");
			if (!Object.keys(payload).length) return err("Payload cannot be empty");

			await env.DB.prepare(`
				INSERT INTO contributions (user_id, type, waza_id, payload, status, created_at)
				VALUES (?, ?, ?, ?, 'pending', datetime('now'))
			`)
				.bind(user.id, type, waza_id ?? null, JSON.stringify(payload))
				.run();

			return json({ success: true });
		}

		// ── Admin ─────────────────────────────────────────────────

		if (path === "/admin") {
			const user = await getUser();
			if (!user || !user.is_admin)
				return new Response("Forbidden", { status: 403 });
			const html = await renderAdmin(env);
			return new Response(html, { headers: { "content-type": "text/html" } });
		}

		// GET /api/admin/contributions
		if (path === "/api/admin/contributions" && request.method === "GET") {
			const user = await getUser();
			if (!user || !user.is_admin) return err("Forbidden", 403);

			const status = url.searchParams.get("status") || "pending";
			const { results } = await env.DB.prepare(`
				SELECT c.*, u.username, w.name_jp as waza_name_jp
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

		// GET /api/admin/waza/:id
		if (path.startsWith("/api/admin/waza/") && request.method === "GET") {
			const user = await getUser();
			if (!user || !user.is_admin) return err("Forbidden", 403);

			const id = path.split("/").pop();
			const waza = await env.DB.prepare("SELECT * FROM waza WHERE id = ?")
				.bind(id)
				.first();
			if (!waza) return err("Waza not found", 404);
			return json(waza);
		}

		// POST /api/admin/contributions/:id/approve
		if (
			path.match(/^\/api\/admin\/contributions\/\d+\/approve$/) &&
			request.method === "POST"
		) {
			const user = await getUser();
			if (!user || !user.is_admin) return err("Forbidden", 403);

			const id = path.split("/")[4];
			const body = await request.json();
			const finalPayload = body.payload;

			const contrib = await env.DB.prepare(
				"SELECT * FROM contributions WHERE id = ?"
			)
				.bind(id)
				.first();
			if (!contrib) return err("Not found", 404);
			if (contrib.status !== "pending") return err("Already reviewed");

			const payload = finalPayload ?? JSON.parse(contrib.payload as string);

			if (contrib.type === "edit") {
				const keys = Object.keys(payload);
				if (!keys.length) return err("Empty payload");
				const setClause = keys.map((k) => `${k} = ?`).join(", ");
				const values = keys.map((k) => payload[k]);
				await env.DB.prepare(`UPDATE waza SET ${setClause} WHERE id = ?`)
					.bind(...values, contrib.waza_id)
					.run();
			} else {
				const keys = Object.keys(payload);
				const cols = keys.join(", ");
				const placeholders = keys.map(() => "?").join(", ");
				const values = keys.map((k) => payload[k]);
				await env.DB.prepare(
					`INSERT INTO waza (${cols}) VALUES (${placeholders})`
				)
					.bind(...values)
					.run();
			}

			await env.DB.prepare(`
				UPDATE contributions
				SET status = 'approved', reviewed_at = datetime('now'), admin_note = ?
				WHERE id = ?
			`)
				.bind(body.note ?? null, id)
				.run();

			return json({ success: true });
		}

		// POST /api/admin/contributions/:id/reject
		if (
			path.match(/^\/api\/admin\/contributions\/\d+\/reject$/) &&
			request.method === "POST"
		) {
			const user = await getUser();
			if (!user || !user.is_admin) return err("Forbidden", 403);

			const id = path.split("/")[4];
			const { note } = await request.json();

			const contrib = await env.DB.prepare(
				"SELECT id, status FROM contributions WHERE id = ?"
			)
				.bind(id)
				.first();
			if (!contrib) return err("Not found", 404);
			if (contrib.status !== "pending") return err("Already reviewed");

			await env.DB.prepare(`
				UPDATE contributions
				SET status = 'rejected', reviewed_at = datetime('now'), admin_note = ?
				WHERE id = ?
			`)
				.bind(note ?? null, id)
				.run();

			return json({ success: true });
		}

		// ── Groups ────────────────────────────────────────────────────

		// GET /api/groups — list all groups with member count (public)
		if (path === "/api/groups" && request.method === "GET") {
		const { results } = await env.DB.prepare(`
			SELECT
			g.id,
			g.name,
			g.join_policy,
			g.social,
			g.created_at,
			COUNT(gm.user_id) AS member_count
			FROM groups g
			LEFT JOIN group_members gm ON gm.group_id = g.id
			GROUP BY g.id
			ORDER BY g.created_at DESC
		`).all();
		return json(results);
		}

		// GET /api/groups/:id — group detail (public)
		if (path.match(/^\/api\/groups\/\d+$/) && request.method === "GET") {
		const groupId = +path.split("/")[3];
		const group = await env.DB.prepare(`
			SELECT
			g.*,
			COUNT(gm.user_id) AS member_count
			FROM groups g
			LEFT JOIN group_members gm ON gm.group_id = g.id
			WHERE g.id = ?
			GROUP BY g.id
		`).bind(groupId).first();
		if (!group) return err("Group not found", 404);
		// Strip invite_key from public response
		const { invite_key: _ik, ...publicGroup } = group as Record<string, unknown>;
		return json(publicGroup);
		}

		// POST /api/groups — create a group
		if (path === "/api/groups" && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const body = await request.json() as Record<string, unknown>;
		const name = (body.name as string | undefined)?.trim();
		const join_policy = (body.join_policy as string | undefined) ?? "open";
		const social = body.social ?? [];

		if (!name || name.length === 0) return err("Group name is required");
		if (name.length > 64) return err("Group name must be 64 characters or fewer");
		if (!["open", "approval", "invite"].includes(join_policy))
			return err("Invalid join policy");
		if (!Array.isArray(social)) return err("social must be an array");
		if (social.length > 10) return err("Maximum 10 social links");

		// Generate invite key if needed
		let invite_key: string | null = null;
		if (join_policy === "invite") {
			const buf = crypto.getRandomValues(new Uint8Array(32));
			invite_key = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
		}

		const result = await env.DB.prepare(`
			INSERT INTO groups (name, join_policy, invite_key, social, created_by)
			VALUES (?, ?, ?, ?, ?)
		`).bind(name, join_policy, invite_key, JSON.stringify(social), user.id).run();

		const groupId = result.meta.last_row_id as number;

		// Add creator as admin member
		await env.DB.prepare(`
			INSERT INTO group_members (group_id, user_id, role)
			VALUES (?, ?, 'admin')
		`).bind(groupId, user.id).run();

		return json({ success: true, group_id: groupId, invite_key });
		}

		// PUT /api/groups/:id — update group (Group admin only)
		if (path.match(/^\/api\/groups\/\d+$/) && request.method === "PUT") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const body = await request.json() as Record<string, unknown>;
		const updates: string[] = [];
		const values: unknown[] = [];

		if (body.name !== undefined) {
			const name = (body.name as string).trim();
			if (!name || name.length > 64) return err("Invalid group name");
			updates.push("name = ?"); values.push(name);
		}
		if (body.join_policy !== undefined) {
			if (!["open", "approval", "invite"].includes(body.join_policy as string))
			return err("Invalid join policy");
			updates.push("join_policy = ?"); values.push(body.join_policy);
		}
		if (body.social !== undefined) {
			if (!Array.isArray(body.social)) return err("social must be an array");
			if ((body.social as unknown[]).length > 10) return err("Maximum 10 social links");
			updates.push("social = ?"); values.push(JSON.stringify(body.social));
		}
		if (!updates.length) return err("Nothing to update");

		values.push(groupId);
		await env.DB.prepare(`UPDATE groups SET ${updates.join(", ")} WHERE id = ?`)
			.bind(...values).run();

		return json({ success: true });
		}

		// DELETE /api/groups/:id — delete group (Group admin only)
		if (path.match(/^\/api\/groups\/\d+$/) && request.method === "DELETE") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		await env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(groupId).run();
		return json({ success: true });
		}

		// POST /api/groups/:id/invite-key — regenerate invite key (Group admin only)
		if (path.match(/^\/api\/groups\/\d+\/invite-key$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const buf = crypto.getRandomValues(new Uint8Array(32));
		const invite_key = Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");

		await env.DB.prepare("UPDATE groups SET invite_key = ? WHERE id = ?")
			.bind(invite_key, groupId).run();

		return json({ success: true, invite_key });
		}

		// GET /api/groups/:id/members — member list (members only)
		if (path.match(/^\/api\/groups\/\d+\/members$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (!role) return err("Forbidden", 403);

		const { results } = await env.DB.prepare(`
			SELECT
			gm.user_id,
			u.username,
			gm.role,
			gm.tag,
			gm.joined_at
			FROM group_members gm
			JOIN users u ON u.id = gm.user_id
			WHERE gm.group_id = ?
			ORDER BY
			CASE gm.role WHEN 'admin' THEN 0 ELSE 1 END,
			gm.joined_at ASC
		`).bind(groupId).all();

		return json(results);
		}

		// POST /api/groups/:id/join — join or apply to join
		if (path.match(/^\/api\/groups\/\d+\/join$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];

		// Already a member?
		const existing = await getGroupRole(groupId, user.id);
		if (existing) return err("Already a member of this group");

		const group = await env.DB.prepare(
			"SELECT join_policy, invite_key FROM groups WHERE id = ?"
		).bind(groupId).first();
		if (!group) return err("Group not found", 404);

		const policy = group.join_policy as string;

		if (policy === "open") {
			await env.DB.prepare(`
			INSERT INTO group_members (group_id, user_id, role)
			VALUES (?, ?, 'member')
			`).bind(groupId, user.id).run();
			// Clean up any stale application row
			await env.DB.prepare(
			"DELETE FROM group_applications WHERE group_id = ? AND user_id = ?"
			).bind(groupId, user.id).run();
			return json({ success: true, status: "joined" });
		}

		if (policy === "approval") {
			// Delete any prior rejected row so the user can re-apply
			await env.DB.prepare(
			"DELETE FROM group_applications WHERE group_id = ? AND user_id = ? AND status = 'rejected'"
			).bind(groupId, user.id).run();
			try {
			await env.DB.prepare(`
				INSERT INTO group_applications (group_id, user_id, status)
				VALUES (?, ?, 'pending')
			`).bind(groupId, user.id).run();
			} catch {
			return err("You already have a pending application for this group");
			}
			return json({ success: true, status: "pending" });
		}

		if (policy === "invite") {
			const body = await request.json() as Record<string, unknown>;
			const provided = (body.invite_key as string | undefined)?.trim();
			if (!provided) return err("An invite key is required to join this group");
			if (provided !== group.invite_key) return err("Invalid invite key");
			// Key is valid — create a pending application (still needs admin approval)
			await env.DB.prepare(
			"DELETE FROM group_applications WHERE group_id = ? AND user_id = ? AND status = 'rejected'"
			).bind(groupId, user.id).run();
			try {
			await env.DB.prepare(`
				INSERT INTO group_applications (group_id, user_id, status)
				VALUES (?, ?, 'pending')
			`).bind(groupId, user.id).run();
			} catch {
			return err("You already have a pending application for this group");
			}
			return json({ success: true, status: "pending" });
		}

		return err("Unknown join policy");
		}

		// POST /api/groups/:id/members/:uid/approve — approve application
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+\/approve$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const app = await env.DB.prepare(
			"SELECT id, status FROM group_applications WHERE group_id = ? AND user_id = ?"
		).bind(groupId, targetId).first();
		if (!app) return err("Application not found", 404);
		if ((app.status as string) !== "pending") return err("Application is not pending");

		await env.DB.batch([
			env.DB.prepare(
			"UPDATE group_applications SET status = 'approved' WHERE group_id = ? AND user_id = ?"
			).bind(groupId, targetId),
			env.DB.prepare(
			"INSERT OR IGNORE INTO group_members (group_id, user_id, role) VALUES (?, ?, 'member')"
			).bind(groupId, targetId),
		]);

		return json({ success: true });
		}

		// POST /api/groups/:id/members/:uid/reject — reject application
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+\/reject$/) && request.method === "POST") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const app = await env.DB.prepare(
			"SELECT id, status FROM group_applications WHERE group_id = ? AND user_id = ?"
		).bind(groupId, targetId).first();
		if (!app) return err("Application not found", 404);
		if ((app.status as string) !== "pending") return err("Application is not pending");

		await env.DB.prepare(
			"UPDATE group_applications SET status = 'rejected' WHERE group_id = ? AND user_id = ?"
		).bind(groupId, targetId).run();

		return json({ success: true });
		}

		// PUT /api/groups/:id/members/:uid — update member tag or role
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+$/) && request.method === "PUT") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		const callerRole = await getGroupRole(groupId, user.id);
		if (callerRole !== "admin") return err("Forbidden", 403);

		const body = await request.json() as Record<string, unknown>;
		const updates: string[] = [];
		const values: unknown[] = [];

		if (body.tag !== undefined) {
			updates.push("tag = ?");
			values.push(body.tag === null ? null : String(body.tag).slice(0, 64));
		}
		if (body.role !== undefined) {
			if (!["admin", "member"].includes(body.role as string))
			return err("Invalid role");
			// Prevent demoting the last admin
			if (body.role === "member") {
			const adminCount = await env.DB.prepare(
				"SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND role = 'admin'"
			).bind(groupId).first();
			const targetMember = await env.DB.prepare(
				"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
			).bind(groupId, targetId).first();
			if (
				(targetMember?.role as string) === "admin" &&
				((adminCount?.n as number) ?? 0) <= 1
			) {
				return err("Cannot demote the only admin. Promote another member first.");
			}
			}
			updates.push("role = ?");
			values.push(body.role);
		}
		if (!updates.length) return err("Nothing to update");

		values.push(groupId, targetId);
		await env.DB.prepare(
			`UPDATE group_members SET ${updates.join(", ")} WHERE group_id = ? AND user_id = ?`
		).bind(...values).run();

		return json({ success: true });
		}

		// DELETE /api/groups/:id/members/:uid — leave or remove member
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+$/) && request.method === "DELETE") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		const callerRole = await getGroupRole(groupId, user.id);
		if (!callerRole) return err("Forbidden", 403);

		const isSelf = user.id === targetId;
		if (!isSelf && callerRole !== "admin") return err("Forbidden", 403);

		// Prevent sole admin from leaving
		const targetMember = await env.DB.prepare(
			"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
		).bind(groupId, targetId).first();
		if (!targetMember) return err("Member not found", 404);

		if ((targetMember.role as string) === "admin") {
			const adminCount = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM group_members WHERE group_id = ? AND role = 'admin'"
			).bind(groupId).first();
			if (((adminCount?.n as number) ?? 0) <= 1) {
			return err(
				isSelf
				? "Cannot leave — you are the only admin. Promote another member first."
				: "Cannot remove the only admin. Promote another member first."
			);
			}
		}

		await env.DB.batch([
			env.DB.prepare(
			"DELETE FROM group_members WHERE group_id = ? AND user_id = ?"
			).bind(groupId, targetId),
			env.DB.prepare(
			"DELETE FROM group_applications WHERE group_id = ? AND user_id = ?"
			).bind(groupId, targetId),
		]);

		return json({ success: true });
		}

		// GET /api/groups/:id/members/:uid/progress — fetch a member's progress for Compare
		if (path.match(/^\/api\/groups\/\d+\/members\/\d+\/progress$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const parts = path.split("/");
		const groupId = +parts[3];
		const targetId = +parts[5];

		// Caller must be a member
		const callerRole = await getGroupRole(groupId, user.id);
		if (!callerRole) return err("Forbidden", 403);

		// Target must also be a member
		const targetRole = await getGroupRole(groupId, targetId);
		if (!targetRole) return err("Target user is not a member of this group", 403);

		const { results: progressRows } = await env.DB.prepare(
			"SELECT waza_id, markings, like FROM progress WHERE user_id = ?"
		).bind(targetId).all();

		const labelsRow = await env.DB.prepare(
			"SELECT shape_labels FROM users WHERE id = ?"
		).bind(targetId).first();

		const markings: Record<number, { markings: boolean[], like: number | null }> = {};
		for (const row of progressRows) {
			let parsed = Array(6).fill(false);
			try { parsed = JSON.parse(row.markings as string); } catch { /* keep default */ }
			markings[row.waza_id as number] = {
			markings: parsed,
			like: (row.like as number | null) ?? null,
			};
		}

		const labels = labelsRow?.shape_labels
			? JSON.parse(labelsRow.shape_labels as string)
			: ["", "", "", "", "", ""];

		return json({ markings, labels });
		}

		// GET /api/groups/:id/applications — pending applications (Group admin only)
		if (path.match(/^\/api\/groups\/\d+\/applications$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const { results } = await env.DB.prepare(`
			SELECT
			ga.id,
			ga.user_id,
			u.username,
			ga.status,
			ga.applied_at
			FROM group_applications ga
			JOIN users u ON u.id = ga.user_id
			WHERE ga.group_id = ? AND ga.status = 'pending'
			ORDER BY ga.applied_at ASC
		`).bind(groupId).all();

		return json(results);
		}

		// GET /api/groups/mine — groups the current user belongs to (for Compare dropdown)
		if (path === "/api/groups/mine" && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const { results } = await env.DB.prepare(`
			SELECT
			g.id,
			g.name,
			gm.role
			FROM group_members gm
			JOIN groups g ON g.id = gm.group_id
			WHERE gm.user_id = ?
			ORDER BY gm.joined_at ASC
		`).bind(user.id).all();

		return json(results);
		}

		// GET /api/groups/:id/my-status — caller's relationship to a group (public endpoint, auth optional)
		if (path.match(/^\/api\/groups\/\d+\/my-status$/) && request.method === "GET") {
		const groupId = +path.split("/")[3];
		const user = await getUser();
		if (!user) return json({ status: "guest" });

		const member = await env.DB.prepare(
			"SELECT role FROM group_members WHERE group_id = ? AND user_id = ?"
		).bind(groupId, user.id).first();
		if (member) return json({ status: "member", role: member.role });

		const app = await env.DB.prepare(
			"SELECT status FROM group_applications WHERE group_id = ? AND user_id = ?"
		).bind(groupId, user.id).first();
		if (app) return json({ status: "applied", application_status: app.status });

		return json({ status: "none" });
		}

		// GET /api/groups/:id/invite-key — retrieve current invite key (Group admin only)
		if (path.match(/^\/api\/groups\/\d+\/invite-key$/) && request.method === "GET") {
		const user = await getUser();
		if (!user) return err("Authentication required", 401);

		const groupId = +path.split("/")[3];
		const role = await getGroupRole(groupId, user.id);
		if (role !== "admin") return err("Forbidden", 403);

		const group = await env.DB.prepare(
			"SELECT join_policy, invite_key FROM groups WHERE id = ?"
		).bind(groupId).first();
		if (!group) return err("Group not found", 404);
		if ((group.join_policy as string) !== "invite") return err("This group does not use invite keys");

		return json({ invite_key: group.invite_key });
		}

		// ── Fallback — serve app ──────────────────────────────────
		const html = await renderHtml(env, request);
		return new Response(html, { headers: { "content-type": "text/html" } });
	},
} satisfies ExportedHandler<Env>;