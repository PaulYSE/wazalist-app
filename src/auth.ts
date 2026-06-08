/**
 * @file auth.ts (Cloudflare Worker)
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-08
 * @brief Server-side authentication utilities for password hashing (PBKDF2), session token generation, and session validation against D1 database.
 */

/**
 * @brief Hashes a password with PBKDF2 using an optional or newly generated salt.
 *
 * @param {string} password - Plain-text password to hash.
 * @param {string} [salt] - Optional salt string (16 bytes as hex). If not provided, a random salt is generated.
 * @return {Promise<{ hash: string; salt: string }>} Object containing hex-encoded hash and salt.
 */
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const encoder = new TextEncoder();

    // Generate a random salt if not provided
    if(!salt){
        const saltBuffer = crypto.getRandomValues(new Uint8Array(16));
        salt = Array.from(saltBuffer).map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    // Hash password with salt using PBKDF2
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password + salt),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode(salt),
            iterations: 100000,
            hash: 'SHA-256'
        },
        key,
        256
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    return { hash, salt };
}

/**
 * @brief Generates a cryptographically secure random session token.
 *
 * @return {string} Hex-encoded 32-byte random token (64 characters).
 */
export function generateToken(): string {
    const buffer = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(buffer)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * @brief Retrieves a user from a valid session token.
 *
 * Queries the D1 database for a non-expired session and returns the associated user.
 *
 * @param {Env} env - Cloudflare Workers environment bindings (includes D1 database).
 * @param {string} token - Session token (hex string).
 * @return {Promise<Object|null>} User object with id, username, email, is_admin, or null if session invalid/expired.
 */
export async function getUserFromSession(env: Env, token: string) {
    if (!token) return null;

    const user = await env.DB.prepare(`
        SELECT u.id, u.username, u.email, u.is_admin
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.id = ? AND s.expires_at > datetime('now')
    `).bind(token).first();

    return user || null;
}