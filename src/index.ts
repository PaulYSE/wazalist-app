import { renderHtml } from "./renderHtml";
import { hashPassword } from "./auth";

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

		if (path === "/api/progress") {
			const authHeader = request.headers.get("Authorization");
			return new Response(JSON.stringify([]), {
				headers: {
					"content-type": "application/json",
				},
			});
		}

		if (path === '/api/login' && request.method === 'POST') {
			const body = await request.json();
			// Implement login logic with email/pin
			// For now, return demo response
			return new Response(JSON.stringify({ 
				error: "Login not implemented yet",
				token: "demo-token" 
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
			const existing = env.DB.prepare("SELECT id FROM users WHERE username = ?")
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
			const result = env.DB.prepare("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)")
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

		if (path === '/api/progress' && request.method === 'POST') {
			const body = await request.json();
			// Implement progress update logic
			return new Response(JSON.stringify({ success: true }), {
				headers: { "Content-Type": "application/json" }
			});
		}

		const html = await renderHtml(env);
		return new Response(html, {
			headers: {
				"content-type": "text/html",
			},
		});
	},
} satisfies ExportedHandler<Env>;
