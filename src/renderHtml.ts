/**
 * renderHtml.ts — Renders the main application HTML page by fetching the
 * static asset from the Workers assets binding.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Fetches and returns the main index.html static asset.
 *
 * @remarks
 * Always serves the SPA shell (`/index.html`) regardless of the requested
 * path (`/browse`, `/stats`, …). Builds an absolute asset URL from the
 * request origin and fetches it as a proper `Request` so the assets
 * binding resolves it.
 *
 * @param env - Cloudflare Workers environment bindings (includes the
 *   `ASSETS` binding).
 * @param request - The incoming request, used to derive the asset origin.
 * @returns HTML content of `index.html`.
 */
export async function renderHtml(env: Env, request: Request) {
  // Always serve the SPA shell (/index.html), regardless of the requested path
  // (/browse, /stats, …). Build an absolute asset URL from the request origin
  // and fetch it as a proper Request so the assets binding resolves it.
  const assetUrl = new URL('/index.html', new URL(request.url).origin);
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString()));
  return response.text();
}
