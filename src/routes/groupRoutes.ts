/**
 * groupRoutes.ts — Route handler for group listing, lookup, and creation.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { RequestContext } from '../types/request';

import { err, json } from '../utils/responses';

import { readGroupBody, validateGroupCreate } from '../groupsValidation';

import type { GroupCreateInput } from '../groupsValidation';

import { ValidationError } from '../validation';

import { isRateLimited } from '../utils/rateLimit';

/**
 * Handles group API routes.
 *
 * @remarks
 * Matches three endpoints:
 *
 * - `GET /api/groups` — returns every group with its `member_count`,
 *   ordered by `created_at` descending.
 * - `GET /api/groups/:id` — returns a single group with its
 *   `member_count`, omitting `invite_key` from the response.
 * - `POST /api/groups` — requires authentication. Non-admins are limited
 *   to five group creations per 24 hours. The body is validated via
 *   `readGroupBody` and `validateGroupCreate`, a 64-character hex invite
 *   key is generated, and the group and its admin membership row are
 *   inserted atomically in a single D1 batch.
 *
 * Returns `null` for any unmatched path or method so the caller can
 * continue route dispatch.
 *
 * @param ctx - Shared request context.
 * @returns A response when a group route matches, otherwise `null`.
 */
export async function handleGroupRoutes(ctx: RequestContext): Promise<Response | null> {
  const { request, env, path, getUser } = ctx;

  // ── List groups ───────────────────────────────────────────
  if (path === '/api/groups' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `
      SELECT
        g.id,
        g.name,
        g.join_policy,
        g.social,
        g.created_at,
        COUNT(gm.user_id) AS member_count
      FROM groups g
      LEFT JOIN group_members gm
        ON gm.group_id = g.id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `,
    ).all();

    return json(results);
  }

  // ── Get group details ──────────────────────────────────────
  if (path.match(/^\/api\/groups\/\d+$/) && request.method === 'GET') {
    const groupId = +path.split('/')[3];

    const group = await env.DB.prepare(
      `
    SELECT
      g.*,
      COUNT(gm.user_id) AS member_count
    FROM groups g
    LEFT JOIN group_members gm
      ON gm.group_id = g.id
    WHERE g.id = ?
    GROUP BY g.id
  `,
    )
      .bind(groupId)
      .first();

    if (!group) {
      return err('Group not found', 404);
    }

    const { invite_key: _inviteKey, ...publicGroup } = group as Record<string, unknown>;

    return json(publicGroup);
  }

  // ── Create group ───────────────────────────────────────────
  if (path === '/api/groups' && request.method === 'POST') {
    const user = await getUser();

    if (!user) {
      return err('Authentication required', 401);
    }

    if (!user.is_admin) {
      const limited = await isRateLimited(
        env.DB,
        'groups',
        'created_by',
        'created_at',
        user.id,
        5,
        '-24 hours',
      );

      if (limited) {
        return err(
          'You have created too many groups recently. Please wait before creating another.',
          429,
        );
      }
    }

    let input: GroupCreateInput;

    try {
      const body = await readGroupBody(request);
      input = validateGroupCreate(body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      throw error;
    }

    const { name, join_policy, social } = input;

    const buffer = crypto.getRandomValues(new Uint8Array(32));

    const inviteKey = Array.from(buffer)
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    try {
      const [groupResult] = await env.DB.batch([
        env.DB.prepare(
          `
        INSERT INTO groups
          (name, join_policy, invite_key, social, created_by)
        VALUES (?, ?, ?, ?, ?)
      `,
        ).bind(name, join_policy, inviteKey, JSON.stringify(social), user.id),

        env.DB.prepare(
          `
        INSERT INTO group_members
          (group_id, user_id, role)
        VALUES (
          (SELECT id FROM groups WHERE invite_key = ?),
          ?,
          'admin'
        )
      `,
        ).bind(inviteKey, user.id),
      ]);

      const groupId = groupResult.meta.last_row_id;

      return json({
        success: true,
        group_id: groupId,
        invite_key: inviteKey,
      });
    } catch (error) {
      console.error('Atomic group creation failed:', error);

      return err('Could not create the group. Please try again.', 500);
    }
  }

  return null;
}
