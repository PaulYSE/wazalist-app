/**
 * auth.ts — Server-side authentication utilities for password hashing
 * (PBKDF2), session token generation, and session validation against the
 * D1 database.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * User row returned by `getUserFromSession`.
 */
export type User = {
  id: number;
  username: string;
  email: string | null;
  is_admin: number;
};

/**
 * Hashes a password with PBKDF2 using an optional or newly generated salt.
 *
 * @remarks
 * The salt is used in two places: it is concatenated to the password to form
 * the PBKDF2 key material (`password + salt`), and it is also passed as the
 * PBKDF2 `salt` parameter. When `salt` is omitted, a random 16-byte salt is
 * generated and returned so it can be stored alongside the hash.
 *
 * No validation is performed on a caller-supplied `salt` — any string is
 * accepted as-is.
 *
 * @param password - Plain-text password to hash.
 * @param salt - Optional salt string. If not provided, a random 16-byte
 *   salt (hex-encoded, 32 characters) is generated.
 * @returns Object containing the hex-encoded hash and the salt used.
 */
export async function hashPassword(
  password: string,
  salt?: string,
): Promise<{ hash: string; salt: string }> {
  const encoder = new TextEncoder();

  // Generate a random salt if not provided
  if (!salt) {
    const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(saltBuffer)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Hash password with salt using PBKDF2
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password + salt),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    key,
    256,
  );

  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return { hash, salt };
}

/**
 * Generates a cryptographically secure random session token.
 *
 * @remarks
 * The function is a generic random-hex generator — it does not itself tie
 * the output to a session. It is currently used to produce session tokens.
 *
 * @returns Hex-encoded 32-byte random token (64 characters).
 */
export function generateToken(): string {
  const buffer = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Retrieves a user from a valid session token.
 *
 * @remarks
 * Queries the D1 database for a session whose `expires_at` is in the future
 * and joins it to the `users` table to return the associated user row.
 * Returns `null` for an empty token, an invalid token, or an expired session.
 *
 * @param env - Cloudflare Workers environment bindings (includes the D1
 *   database binding `DB`).
 * @param token - Session token (hex string).
 * @returns The user row, or `null` if the session is invalid or expired.
 */
export async function getUserFromSession(env: Env, token: string): Promise<User | null> {
  if (!token) return null;

  const user = await env.DB.prepare(
    `
        SELECT u.id, u.username, u.email, u.is_admin
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.id = ? AND s.expires_at > datetime('now')
    `,
  )
    .bind(token)
    .first<User>();

  return user ?? null;
}
