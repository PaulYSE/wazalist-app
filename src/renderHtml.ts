export async function renderHtml(env: Env, request: Request) {
	const response = await env.ASSETS.fetch(new URL("/index.html", request.url));
	return response.text();
}