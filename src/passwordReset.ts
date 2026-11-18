/**
 * passwordReset.ts — Token generation, hashing, and request validation for
 * the password-reset flow.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import { generateToken } from './auth';
import { ValidationError, requireObject } from './validation';

/**
 * Number of hours a password-reset link remains valid.
 */
export const PASSWORD_RESET_EXPIRY_HOURS = 24;

/**
 * Expected length, in hexadecimal characters, of a password-reset token.
 */
export const PASSWORD_RESET_TOKEN_HEX_LENGTH = 64;

/**
 * Subject line used for password-reset emails.
 */
export const PASSWORD_RESET_ADMIN_SUBJECT = '<Wazalist App by IFX> Account Recovery Request';

const MAX_IDENTIFIER_LENGTH = 254;

/**
 * Generates a cryptographically secure password-reset token.
 *
 * @remarks
 * The token contains 256 random bits represented as 64 lowercase
 * hexadecimal characters. Delegates to `generateToken` from `auth.ts`.
 *
 * @returns Raw password-reset token.
 */
export function generatePasswordResetToken(): string {
  return generateToken();
}

/**
 * Hashes an exact token value using SHA-256.
 *
 * @remarks
 * Only this hash is stored in D1. The raw token is sent through the
 * recovery link and must not be logged or persisted.
 *
 * @param token - Raw password-reset token.
 * @returns Lowercase hexadecimal SHA-256 digest.
 */
export async function hashPasswordResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));

  return bytesToHex(new Uint8Array(digest));
}

/**
 * Produces a keyed SHA-256 hash of a client IP address.
 *
 * @remarks
 * Uses HMAC so an exposed database hash cannot be compared against a
 * simple precomputed list of common IP addresses without the Worker
 * secret. The IP is trimmed before hashing.
 *
 * @param ip - Raw client IP address.
 * @param secret - Server-side HMAC secret.
 * @returns Lowercase hexadecimal HMAC digest.
 * @throws Error If `secret` is empty.
 */
export async function hashPasswordResetIp(ip: string, secret: string): Promise<string> {
  if (!secret) {
    throw new Error('PASSWORD_RESET_IP_HASH_SECRET is not configured');
  }

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    {
      name: 'HMAC',
      hash: 'SHA-256',
    },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(ip.trim()));

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Validates a submitted reset-token string.
 *
 * @remarks
 * Trims and lowercases the input, then checks that it is exactly
 * `PASSWORD_RESET_TOKEN_HEX_LENGTH` lowercase hexadecimal characters.
 *
 * @param value - Submitted token value.
 * @returns Normalized lowercase 64-character hexadecimal token.
 * @throws ValidationError If the token has an invalid format or is not a
 *   string.
 */
export function validatePasswordResetToken(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Password reset token is invalid');
  }

  const token = value.trim().toLowerCase();

  if (!new RegExp(`^[0-9a-f]{${PASSWORD_RESET_TOKEN_HEX_LENGTH}}$`).test(token)) {
    throw new ValidationError('Password reset token is invalid');
  }

  return token;
}

/**
 * Reads and validates a password-reset request body.
 *
 * @remarks
 * The body must be an object containing only an `identifier` field.
 * `identifier` is trimmed and must be a non-empty string of at most 254
 * code points. The same identifier is later matched against both username
 * and email; this function does not classify it.
 *
 * @param value - Parsed request body.
 * @returns Validated recovery identifier.
 * @throws ValidationError If the body is unsupported or invalid.
 */
export function validatePasswordResetRequest(value: unknown): {
  identifier: string;
} {
  const body = requireObject(value, 'Request body');
  rejectUnknownFields(body, ['identifier']);

  if (typeof body.identifier !== 'string') {
    throw new ValidationError('Username or email is required');
  }

  const identifier = body.identifier.trim();
  if (!identifier || [...identifier].length > MAX_IDENTIFIER_LENGTH) {
    throw new ValidationError('Username or email is required');
  }
  return { identifier };
}

/**
 * Reads and validates a reset-token validation body.
 *
 * @remarks
 * The body must be an object containing only a `token` field, which is
 * passed through `validatePasswordResetToken`.
 *
 * @param value - Parsed request body.
 * @returns Validated raw token.
 * @throws ValidationError If the body is unsupported or invalid.
 */
export function validatePasswordResetValidation(value: unknown): { token: string } {
  const body = requireObject(value, 'Request body');
  rejectUnknownFields(body, ['token']);
  return { token: validatePasswordResetToken(body.token) };
}

/**
 * Reads and validates a password-reset confirmation body.
 *
 * @remarks
 * The body must be an object containing only `token` and `new_password`.
 * `token` is validated with `validatePasswordResetToken`. `new_password`
 * must be a non-empty string; it is deliberately not trimmed.
 *
 * @param value - Parsed request body.
 * @returns Validated token and new password.
 * @throws ValidationError If the body is unsupported or invalid.
 */
export function validatePasswordResetConfirmation(value: unknown): {
  token: string;
  newPassword: string;
} {
  const body = requireObject(value, 'Request body');
  rejectUnknownFields(body, ['token', 'new_password']);
  const token = validatePasswordResetToken(body.token);
  if (typeof body.new_password !== 'string' || !body.new_password) {
    throw new ValidationError('New password is required');
  }
  return { token, newPassword: body.new_password };
}

/**
 * Generates a request-specific identifier for an atomic token claim.
 *
 * @remarks
 * Delegates to `generateToken` from `auth.ts`, producing 64 lowercase
 * hexadecimal characters.
 *
 * @returns Cryptographically random 64-character hexadecimal identifier.
 */
export function generateResetConsumptionId(): string {
  return generateToken();
}

/**
 * Throws if the object contains any key not present in `allowed`.
 *
 * @param value - Object to inspect.
 * @param allowed - List of permitted field names.
 * @throws ValidationError If an unsupported field is present.
 */
function rejectUnknownFields(value: Record<string, unknown>, allowed: readonly string[]): void {
  if (Object.keys(value).some((field) => !allowed.includes(field))) {
    throw new ValidationError('Request contains an unsupported field');
  }
}

/**
 * Encodes a byte array as a lowercase hexadecimal string.
 *
 * @param bytes - Bytes to encode.
 * @returns Lowercase hexadecimal representation.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
