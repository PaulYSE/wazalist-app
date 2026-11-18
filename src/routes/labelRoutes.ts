/**
 * labelRoutes.ts — Route handler for marking-label endpoints.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { RequestContext } from '../types/request';

import { parseStoredLabels } from '../utils/labels';

import { readJsonObject } from '../utils/request';

import { err, json } from '../utils/responses';

import { ValidationError } from '../validation';

/**
 * Handles marking-label API routes.
 *
 * @remarks
 * Matches two endpoints on `/api/labels`, both requiring authentication:
 *
 * - `GET` — reads the caller's `shape_labels` column and returns it via
 *   `parseStoredLabels`, falling back to six empty labels when the stored
 *   value is missing or malformed.
 * - `POST` — validates that the body contains a `labels` array of exactly
 *   six strings, then stores its JSON serialization in the caller's
 *   `shape_labels` column.
 *
 * Returns `null` for any unmatched path or method so the caller can
 * continue route dispatch.
 *
 * @param ctx - Shared request context.
 * @returns A response when a marking-label route matches, otherwise `null`.
 */
export async function handleLabelRoutes(ctx: RequestContext): Promise<Response | null> {
  const { request, env, path, getUser } = ctx;

  // ── Get marking labels ────────────────────────────────────
  if (path === '/api/labels' && request.method === 'GET') {
    const user = await getUser();

    if (!user) {
      return err('Authentication required', 401);
    }

    const row = await env.DB.prepare('SELECT shape_labels FROM users WHERE id = ?')
      .bind(user.id)
      .first();

    const labels = parseStoredLabels(row?.shape_labels);

    return json({ labels });
  }

  // ── Save marking labels ───────────────────────────────────
  if (path === '/api/labels' && request.method === 'POST') {
    const user = await getUser();

    if (!user) {
      return err('Authentication required', 401);
    }

    let body: Record<string, unknown>;

    try {
      body = await readJsonObject(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      throw error;
    }

    const { labels } = body;

    if (
      !Array.isArray(labels) ||
      labels.length !== 6 ||
      !labels.every((label) => typeof label === 'string')
    ) {
      return err('labels must be an array of 6 strings');
    }

    await env.DB.prepare('UPDATE users SET shape_labels = ? WHERE id = ?')
      .bind(JSON.stringify(labels), user.id)
      .run();

    return json({ success: true });
  }

  return null;
}
