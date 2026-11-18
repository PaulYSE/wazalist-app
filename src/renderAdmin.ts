/**
 * renderAdmin.ts — Renders the admin HTML page by fetching the static asset
 * from the Workers assets binding.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Fetches and returns the admin.html static asset.
 *
 * @remarks
 * Resolves `/admin.html` relative to the incoming request URL, fetches it
 * through the `ASSETS` binding, and returns the response body as text.
 *
 * @param env - Cloudflare Workers environment bindings (includes the
 *   `ASSETS` binding).
 * @param request - The incoming request, used to construct the asset URL.
 * @returns HTML content of `admin.html`.
 */
export async function renderAdmin(env: Env, request: Request) {
  const response = await env.ASSETS.fetch(new URL('/admin.html', request.url));
  return response.text();
}
