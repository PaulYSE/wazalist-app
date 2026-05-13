import { renderHtml } from "./renderHtml";

export default {
	async fetch(request, env) {
		const stmt = env.DB.prepare("SELECT * FROM waza LIMIT 20");
		const { results } = await stmt.all();

		const html = await renderHtml(env, JSON.stringify(results, null, 2));

		return new Response(html, {
			headers: {
				"content-type": "text/html",
			},
		});
	},
} satisfies ExportedHandler<Env>;