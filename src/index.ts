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

		// ── Waza ──────────────────────────────────────────────────
		if (path === "/api/waza") {
			const { results } = await env.DB.prepare("SELECT * FROM waza").all();
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
				const { waza_id, shapes, like } = await request.json();
				if (!waza_id) return err("waza_id is required");

				await env.DB.prepare(`
					INSERT INTO progress (user_id, waza_id, shapes, like, updated_at)
					VALUES (?, ?, ?, ?, datetime('now'))
					ON CONFLICT (user_id, waza_id) DO UPDATE SET
						shapes = excluded.shapes,
						like = excluded.like,
						updated_at = datetime('now')
				`)
					.bind(user.id, waza_id, shapes ?? "[]", like ?? null)
					.run();

				return json({ success: true });
			}
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