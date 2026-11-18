/**
 * authRoutes.ts — Route handler for login, registration, and current-user
 * endpoints.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { RequestContext } from '../types/request';

import { ValidationError } from '../validation';

import { hashPassword, generateToken } from '../auth';

import { readJsonObject } from '../utils/request';

import { json, err } from '../utils/responses';

/**
 * Handles authentication API routes.
 *
 * @remarks
 * Matches three endpoints:
 *
 * - `POST /api/login` — requires `username` and `password` strings. Looks
 *   up the user, splits the stored `password_hash` on `:` into salt and
 *   hash, re-hashes the submitted password with that salt, and compares
 *   the result. On success, creates a session token valid for 30 days and
 *   returns the token plus a minimal user object (`id`, `username`,
 *   `is_admin`). Invalid credentials return a generic `401`.
 * - `POST /api/register` — requires `username` and `password` strings;
 *   `email` is optional but must be a string when present. Rejects
 *   duplicate usernames. Hashes the password with a fresh salt and stores
 *   it as `salt:hash`. Returns the new user's `id` and `username`.
 * - `GET /api/me` — requires a valid session and returns the resolved
 *   user.
 *
 * Returns `null` for any unmatched path or method so the caller can
 * continue route dispatch.
 *
 * @param ctx - Shared request context.
 * @returns A response when an auth route matches, otherwise `null`.
 */
export async function handleAuthRoutes(ctx: RequestContext): Promise<Response | null> {
  const { request, env, path, getUser } = ctx;

  // ── Login ─────────────────────────────────────────────────
  if (path === '/api/login' && request.method === 'POST') {
    let body: Record<string, unknown>;

    try {
      body = await readJsonObject(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      throw error;
    }

    const { username, password } = body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return err('Username and password are required');
    }

    const user = await env.DB.prepare(
      'SELECT id, username, password_hash, is_admin FROM users WHERE username = ?',
    )
      .bind(username)
      .first();
    if (!user) return err('Invalid username or password', 401);

    const [salt, storedHash] = (user.password_hash as string).split(':');
    const { hash } = await hashPassword(password, salt);
    if (hash !== storedHash) return err('Invalid username or password', 401);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, user.id, expiresAt)
      .run();

    return json({
      success: true,
      token,
      user: { id: user.id, username: user.username, is_admin: user.is_admin },
    });
  }

  // ── Register ──────────────────────────────────────────────
  if (path === '/api/register' && request.method === 'POST') {
    let body: Record<string, unknown>;

    try {
      body = await readJsonObject(request);
    } catch (error) {
      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      throw error;
    }

    const { username, email, password } = body;

    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return err('Username and password are required');
    }

    if (email !== undefined && email !== null && typeof email !== 'string') {
      return err('Email must be a string');
    }

    const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
      .bind(username)
      .first();
    if (existing) return err('User already exists');

    const { hash, salt } = await hashPassword(password);
    const result = await env.DB.prepare(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    )
      .bind(username, email || null, `${salt}:${hash}`)
      .run();

    return json({ success: true, user: { id: result.meta.last_row_id, username } });
  }

  // ── Current user (re-hydrate session on refresh) ──────────
  if (path === '/api/me' && request.method === 'GET') {
    const user = await getUser();
    if (!user) return err('Authentication required', 401);
    return json({ user });
  }

  return null;
}
