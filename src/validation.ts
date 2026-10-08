/**
 * Contribution payload validation.
 *
 * Chunk 1 scope:
 * - Allow only known editable waza fields.
 * - Require string values.
 * - Reject empty payloads and invalid JSON bodies.
 *
 * No trimming, URL validation, length limits, or database access.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const EDITABLE_WAZA_FIELDS = new Set<string>([
  "name_jp",
  "name_en",
  "name_en_literal",
  "name_en_gtranslate",
  "name_cn_gtranslate",
  "reference",
  "tag",
  "parent_jp0",
  "parent_en0",
  "parent_jp1",
  "parent_en1",
  "author_jp0",
  "author_en0",
  "author_jp1",
  "author_en1",
  "video0",
  "video1",
  "video2",
  "video3",
  "video4",
  "video5",
  "video6",
  "video7",
  "video8",
  "video9",
]);

export function requireObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new ValidationError(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

export async function readContributionBody(
  request: Request,
): Promise<Record<string, unknown>> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  return requireObject(parsed, "Request body");
}

export function validateWazaPayload(
  value: unknown,
): Record<string, string> {
  const input = requireObject(value, "Payload");
  const entries = Object.entries(input);

  if (entries.length === 0) {
    throw new ValidationError("Payload cannot be empty");
  }

  const validated: Record<string, string> = Object.create(null);

  for (const [field, fieldValue] of entries) {
    if (!EDITABLE_WAZA_FIELDS.has(field)) {
      // Do not reflect the untrusted field name in the error message.
      throw new ValidationError("Payload contains an unsupported field");
    }

    if (typeof fieldValue !== "string") {
      // field is safe to report after passing the allowlist.
      throw new ValidationError(`${field} must be a string`);
    }

    validated[field] = fieldValue;
  }

  return validated;
}
