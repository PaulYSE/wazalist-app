export async function renderAdmin(env: Env, request: Request) {
	const response = await env.ASSETS.fetch(new URL("/admin.html", request.url));
	return response.text();
}