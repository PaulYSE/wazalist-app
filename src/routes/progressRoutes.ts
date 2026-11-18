/**
 * progressRoutes.ts — Route handler for user progress endpoints.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { RequestContext } from '../types/request';

import { parseStoredMarkings, validateSubmittedMarkings } from '../utils/markings';

import { err, json } from '../utils/responses';

import { ValidationError } from '../validation';

/**
 * Handles progress API routes.
 *
 * @remarks
 * Matches three endpoints on `/api/progress`:
 *
 * - `GET` — returns the caller's rows from `progress` with `markings`
 *   normalized to a serialized six-boolean array. Unauthenticated callers
 *   receive an empty array.
 * - `POST` — validates `waza_id`, `markings`, and `like`, verifies the waza
 *   exists, upserts the row, and returns the updated like/dislike counts
 *   for that waza.
 * - `DELETE` — deletes every `progress` row belonging to the caller.
 *
 * Returns `null` for any unmatched path or method so the caller can
 * continue route dispatch.
 *
 * @param ctx - Shared request context.
 * @returns A response when a progress route matches, otherwise `null`.
 */
export async function handleProgressRoutes(ctx: RequestContext): Promise<Response | null> {
  const { request, env, path, getUser } = ctx;

  // ── Get progress ───────────────────────────────────────────
  if (path === '/api/progress' && request.method === 'GET') {
    const user = await getUser();

    if (!user) {
      return json([]);
    }

    const { results } = await env.DB.prepare('SELECT * FROM progress WHERE user_id = ?')
      .bind(user.id)
      .all();

    const normalizedResults = results.map((row) => ({
      ...row,
      markings: JSON.stringify(parseStoredMarkings(row.markings)),
    }));

    return json(normalizedResults);
  }

  // ── Save progress ──────────────────────────────────────────
  if (path === '/api/progress' && request.method === 'POST') {
    const user = await getUser();

    if (!user) {
      return err('Authentication required', 401);
    }

    let body: Record<string, unknown>;
    let serializedMarkings: string;

    try {
      const parsed: unknown = await request.json();

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ValidationError('Request body must be an object');
      }

      body = parsed as Record<string, unknown>;

      if (!Number.isSafeInteger(body.waza_id) || (body.waza_id as number) <= 0) {
        throw new ValidationError('waza_id must be a positive integer');
      }

      serializedMarkings = validateSubmittedMarkings(body.markings);

      if (body.like !== null && body.like !== 1 && body.like !== -1) {
        throw new ValidationError('like must be null, 1, or -1');
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      if (error instanceof SyntaxError) {
        return err('Request body must be valid JSON', 400);
      }

      throw error;
    }

    const wazaId = body.waza_id as number;
    const likeValue = body.like as -1 | 1 | null;

    const wazaExists = await env.DB.prepare('SELECT 1 FROM waza WHERE id = ?').bind(wazaId).first();

    if (!wazaExists) {
      return err('Waza not found', 404);
    }

    await env.DB.prepare(
      `
    INSERT INTO progress
      (user_id, waza_id, markings, like, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (user_id, waza_id) DO UPDATE SET
      markings = excluded.markings,
      like = excluded.like,
      updated_at = datetime('now')
  `,
    )
      .bind(user.id, wazaId, serializedMarkings, likeValue)
      .run();

    const counts = await env.DB.prepare(
      `
    SELECT
      COALESCE(
        SUM(CASE WHEN like = 1 THEN 1 END),
        0
      ) AS like_count,
      COALESCE(
        SUM(CASE WHEN like = -1 THEN 1 END),
        0
      ) AS dislike_count
    FROM progress
    WHERE waza_id = ?
  `,
    )
      .bind(wazaId)
      .first();

    return json({
      success: true,
      waza_id: wazaId,
      ...counts,
    });
  }

  // ── Delete all progress ────────────────────────────────────
  if (path === '/api/progress' && request.method === 'DELETE') {
    const user = await getUser();

    if (!user) {
      return err('Authentication required', 401);
    }

    await env.DB.prepare('DELETE FROM progress WHERE user_id = ?').bind(user.id).run();

    return json({ success: true });
  }

  return null;
}
