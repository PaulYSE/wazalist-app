import { generateToken } from "./auth";
import {
  ValidationError,
  requireObject,
} from "./validation";

export const PASSWORD_RESET_EXPIRY_HOURS = 24;
export const PASSWORD_RESET_TOKEN_HEX_LENGTH = 64;

export const PASSWORD_RESET_ADMIN_SUBJECT =
  "<Wazalist App by IFX> Account Recovery Request";

const MAX_IDENTIFIER_LENGTH = 254;

/**
 * Generates a cryptographically secure password-reset token.
 *
 * The token contains 256 random bits represented as 64 lowercase
 * hexadecimal characters.
 *
 * @return Raw password-reset token.
 */
export function generatePasswordResetToken(): string {
  return generateToken();
}

/**
 * Hashes an exact token value using SHA-256.
 *
 * Only this hash is stored in D1. The raw token is sent through the
 * recovery link and must not be logged or persisted.
 *
 * @param token Raw password-reset token.
 * @return Lowercase hexadecimal SHA-256 digest.
 */
export async function hashPasswordResetToken(
  token: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );

  return bytesToHex(new Uint8Array(digest));
}
/**
 * Produces a keyed SHA-256 hash of a client IP address.
 *
 * Uses HMAC so an exposed database hash cannot be compared against a
 * simple precomputed list of common IP addresses without the Worker
 * secret.
 *
 * @param ip Raw client IP address.
 * @param secret Server-side HMAC secret.
 * @return Lowercase hexadecimal HMAC digest.
 */
export async function hashPasswordResetIp(
  ip: string,
  secret: string,
): Promise<string> {
  if (!secret) {
    throw new Error(
      "PASSWORD_RESET_IP_HASH_SECRET is not configured",
    );
  }

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(ip.trim()),
  );

  return bytesToHex(new Uint8Array(signature));
}

/**
 * Validates a submitted reset-token string.
 *
 * @param value Submitted token value.
 * @return Normalized lowercase 64-character hexadecimal token.
 * @throws ValidationError If the token has an invalid format.
 */
export function validatePasswordResetToken(
  value: unknown,
): string {
  if (typeof value !== "string") {
    throw new ValidationError(
      "Password reset token is invalid",
    );
  }

  const token = value.trim().toLowerCase();

  if (
    !new RegExp(
      `^[0-9a-f]{${PASSWORD_RESET_TOKEN_HEX_LENGTH}}$`,
    ).test(token)) {
    throw new ValidationError(
      "Password reset token is invalid",
    );
  }

  return token;
}

/**
 * Reads and validates a password-reset request body.
 *
 * The same identifier is later matched against both username and email.
 * This function does not classify the identifier.
 *
 * @param value Parsed request body.
 * @return Validated recovery identifier.
 * @throws ValidationError If the body is unsupported or invalid.
 */
export function validatePasswordResetRequest(
  value: unknown,
): {
  identifier: string;
} {
  const body = requireObject(value, "Request body");
   rejectUnknownFields(body, ["identifier"]);

if (typeof body.identifier !== "string") { throw new ValidationError( "Username or email is required", ); }

const identifier = body.identifier.trim();
if ( !identifier || [...identifier].length > MAX_IDENTIFIER_LENGTH ) { throw new ValidationError( "Username or email is required", ); }
return { identifier }; }

/**
 * Reads and validates a reset-token validation body.
 *
 * @param value Parsed request body.
 * @return Validated raw token.
 * @throws ValidationError If the body is unsupported or invalid.
 */
export function validatePasswordResetValidation( value: unknown, ): { token: string; } { const body = requireObject(value, "Request body");
rejectUnknownFields(body, ["token"]);
return { token: validatePasswordResetToken(body.token), }; }

/**
 * Reads and validates a password-reset confirmation body.
 *
 * The existing Wazalist password baseline requires a nonempty string.
 * Passwords are deliberately not trimmed.
 * @param value Parsed request body.
 * @return Validated token and new password.
 * @throws ValidationError If the body is unsupported or invalid.
 */
export function validatePasswordResetConfirmation( value: unknown, ): { token: string; newPassword: string; } { const body = requireObject(value, "Request body");
rejectUnknownFields(body, [ "token", "new_password", ]);
const token = validatePasswordResetToken(body.token);
if ( typeof body.new_password !== "string" || !body.new_password ) { throw new ValidationError( "New password is required", ); }
return { token, newPassword: body.new_password, }; }

/**
 * Generates a request-specific identifier for an atomic token claim.
 *
 * @return Cryptographically random 64-character hexadecimal identifier.
 */
export function generateResetConsumptionId(): string { return generateToken(); }
function rejectUnknownFields( value: Record<string, unknown>, allowed: readonly string[], ): void { if ( Object.keys(value).some( (field) => !allowed.includes(field), ) ) { throw new ValidationError( "Request contains an unsupported field", ); } }
function bytesToHex(bytes: Uint8Array): string { return Array.from(bytes) .map((byte) => byte.toString(16).padStart(2, "0"), ) .join(""); }
