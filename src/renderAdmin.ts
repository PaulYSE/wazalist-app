export async function renderAdmin(env: Env) {
	const response = await env.ASSETS.fetch('admin.html');
	return response.text();
}