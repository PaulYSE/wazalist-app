/**
 * @file renderAdmin.ts (Cloudflare Worker)
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Renders the admin HTML page by fetching the static asset from the Workers assets binding.
 */

/**
 * @brief Fetches and returns the admin.html static asset.
 *
 * @param {Env} env - Cloudflare Workers environment bindings (includes ASSETS binding).
 * @param {Request} request - The incoming request object used to construct the asset URL.
 * @return {Promise<string>} HTML content of admin.html.
 */
export async function renderAdmin(env: Env, request: Request) {
	const response = await env.ASSETS.fetch(new URL("/admin.html", request.url));
	return response.text();
}
