import { renderHtml } from "./renderHtml";

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
			// Implement registration logic
			return new Response(JSON.stringify({ 
				error: "Registration not implemented yet"
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
