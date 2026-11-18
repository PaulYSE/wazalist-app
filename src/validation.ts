/**
 * validation.ts — Shared validation primitives used across the Worker:
 * `ValidationError`, `requireObject`, and contribution payload validation.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Error thrown when a request payload fails validation.
 *
 * @remarks
 * Sets `name` to `"ValidationError"` so callers can identify it via
 * `instanceof` or by name when crossing serialization boundaries.
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Waza fields that contributions are allowed to edit.
 *
 * @remarks
 * Used by `validateWazaPayload` as an allowlist. Any field not in this
 * set is rejected. The list intentionally covers only user-editable text,
 * parent/author relations, and the ten video slots.
 */
const EDITABLE_WAZA_FIELDS = new Set<string>([
  'name_jp',
  'name_en',
  'name_en_literal',
  'name_en_gtranslate',
  'name_cn_gtranslate',
  'reference',
  'tag',
  'parent_jp0',
  'parent_en0',
  'parent_jp1',
  'parent_en1',
  'author_jp0',
  'author_en0',
  'author_jp1',
  'author_en1',
  'video0',
  'video1',
  'video2',
  'video3',
  'video4',
  'video5',
  'video6',
  'video7',
  'video8',
  'video9',
]);

/**
 * Ensures a value is a plain (non-array, non-null) object.
 *
 * @param value - Value to check.
 * @param label - Human-readable label used in the error message.
 * @returns The value narrowed to `Record<string, unknown>`.
 * @throws ValidationError If the value is `null`, not an object, or an
 *   array.
 */
export function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

/**
 * Reads and parses a contribution request body as a JSON object.
 *
 * @param request - Incoming request.
 * @returns Parsed body as a plain object.
 * @throws ValidationError If the body is not valid JSON or is not a plain
 *   object.
 */
export async function readContributionBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  return requireObject(parsed, 'Request body');
}

/**
 * Validates a waza contribution payload.
 *
 * @remarks
 * The payload must be a non-empty plain object. Every key must be in
 * `EDITABLE_WAZA_FIELDS`, and every value must be a string. No trimming,
 * URL validation, or length checks are performed here. Unsupported field
 * names are not echoed back in the error message; after a field passes the
 * allowlist, its name may appear in error messages.
 *
 * @param value - Candidate payload.
 * @returns A new null-prototype object containing only the validated
 *   `field → string` pairs.
 * @throws ValidationError If the payload is empty, contains an unsupported
 *   field, or contains a non-string value.
 */
export function validateWazaPayload(value: unknown): Record<string, string> {
  const input = requireObject(value, 'Payload');
  const entries = Object.entries(input);

  if (entries.length === 0) {
    throw new ValidationError('Payload cannot be empty');
  }

  const validated: Record<string, string> = Object.create(null);

  for (const [field, fieldValue] of entries) {
    if (!EDITABLE_WAZA_FIELDS.has(field)) {
      // Do not reflect the untrusted field name in the error message.
      throw new ValidationError('Payload contains an unsupported field');
    }

    if (typeof fieldValue !== 'string') {
      // field is safe to report after passing the allowlist.
      throw new ValidationError(`${field} must be a string`);
    }

    validated[field] = fieldValue;
  }

  return validated;
}
