import { renderHtml } from "./renderHtml";
import { hashPassword, generateToken, getUserFromSession } from "./auth";

export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === "/api/waza") {
			const stmt = env.DB.prepare("SELECT * FROM waza");
			const { results } = await stmt.all();
			return new Response(JSON.stringify(results), {
				headers: {
					"content-type": "application/json",
				},
			});
		}

		if (path === '/api/login' && request.method === 'POST') {
			const body = await request.json();
			const { username, password } = body;

			// Validate
			if (!username || !password) {
				return new Response(JSON.stringify({ error: "Username and password are required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" }
				});
			}

			// Fetch user from database
			const user = await env.DB.prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
				.bind(username)
				.first();

			// If user not found, return error
			if (!user) {
				return new Response(JSON.stringify({ error: "Invalid username or password" }), {
					status: 401,
					headers: { "Content-Type": "application/json" }
				});
    		}

			// Salt and hash the provided password
			const [salt, storedHash] = user.password_hash.split(':');
			const { hash } = await hashPassword(password, salt);

			// Check if the provided password matches the stored hash
			if (hash !== storedHash) {
				return new Response(JSON.stringify({ error: "Invalid username or password" }), {
					status: 401,
					headers: { "Content-Type": "application/json" }
				});
			}

			// Successful login
			const token = generateToken();
			const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

			await env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
				.bind(token, user.id, expiresAt)
				.run();

			return new Response(JSON.stringify({ 
				success: true,
				token: token,
				user: { id: user.id, username: user.username }
			}), {
				headers: { "Content-Type": "application/json" }
			});		
		}

		if (path === '/api/register' && request.method === 'POST') {
			const body = await request.json();
			const { username, email, password } = body;

			// Validate
			if (!username || !password) {
				return new Response(JSON.stringify({ error: "Username and password are required" }), {
					status: 400,
					headers: { "Content-Type": "application/json" }
				});
			}

			// Check for existing user
			const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?")
				.bind(username)
				.first();
			
			if (existing) {
				return new Response(JSON.stringify({ error: "User already exists" }), {
					status: 400,
					headers: { "Content-Type": "application/json" }
				});
			}

			// Hash password
			const { hash, salt } = await hashPassword(password);
			const passwordHash = `${salt}:${hash}`;

			// Store user in database
			const result = await env.DB.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
				.bind(username, email || null, passwordHash)
				.run();

			// New user created, return success response
			return new Response(JSON.stringify({ 
				success: true,
				user: { id: result.meta.last_row_id, username }			
			}), {
				headers: { "Content-Type": "application/json" }
			});
		}

		if (path === '/api/progress') {
			const authHeader = request.headers.get("Authorization");
			const token = authHeader?.replace("Bearer ", "");
			
			// Try to get user, but don't fail if no token
			const user = token ? await getUserFromSession(env, token) : null;

			if (request.method === 'GET') {
				// Authenticated user — fetch from database
				if (user) {
					const { results } = await env.DB.prepare(
						"SELECT * FROM progress WHERE user_id = ?"
					).bind(user.id).all();
					
					return new Response(JSON.stringify(results), {
						headers: { "Content-Type": "application/json" }
					});
				}
				
				// Guest — return empty array (frontend uses localStorage)
				return new Response(JSON.stringify([]), {
					headers: { "Content-Type": "application/json" }
				});
			}

			if (request.method === 'POST') {
				// Guest — reject (they use localStorage, not the server)
				if (!user) {
					return new Response(JSON.stringify({ error: "Authentication required to save progress" }), {
						status: 401,
						headers: { "Content-Type": "application/json" }
					});
				}
				
				// Authenticated user — save to database
				const body = await request.json();
				const { waza_id, shapes, like } = body;

				if (!waza_id) {
					return new Response(JSON.stringify({ error: "waza_id is required" }), {
						status: 400,
						headers: { "Content-Type": "application/json" }
					});
				}

				await env.DB.prepare(`
					INSERT INTO progress (user_id, waza_id, shapes, like, updated_at)
					VALUES (?, ?, ?, ?, datetime('now'))
					ON CONFLICT (user_id, waza_id) DO UPDATE SET
						shapes     = excluded.shapes,
						like       = excluded.like,
						updated_at = datetime('now')
				`).bind(
					user.id,
					waza_id,
					shapes ?? '[]',
					like ?? null
				).run();

				return new Response(JSON.stringify({ success: true }), {
					headers: { "Content-Type": "application/json" }
				});
			}
		}

		const html = await renderHtml(env);
		return new Response(html, {
			headers: {
				"content-type": "text/html",
			},
		});
	},
} satisfies ExportedHandler<Env>;