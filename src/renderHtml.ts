export async function renderHtml(env: Env) {
	// Just serve the HTML file from assets
	const response = await env.ASSETS.fetch('index.html');
	return response.text();
}