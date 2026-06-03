import { renderHtml } from "./renderHtml";
import { renderAdmin } from "./renderAdmin";
import { hashPassword, generateToken, getUserFromSession } from "./auth";

const json = (data: unknown, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" },
	});

const err = (msg: string, status = 400) => json({ error: msg }, status);

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// ── Auth helpers ──────────────────────────────────────────
		const authHeader = request.headers.get("Authorization");
		const sessionToken = authHeader?.replace("Bearer ", "") || "";
		const getUser = () =>
			sessionToken ? getUserFromSession(env, sessionToken) : null;

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

		// ── Fallback — serve app ──────────────────────────────────
		const html = await renderHtml(env);
		return new Response(html, { headers: { "content-type": "text/html" } });
	},
} satisfies ExportedHandler<Env>;