/**
 * groupsValidation.ts — Validation and parsing utilities for group create
 * and update payloads.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import { ValidationError, requireObject } from './validation';

/**
 * Allowed join policies for a group.
 */
export type GroupJoinPolicy = 'open' | 'approval' | 'invite';

/**
 * A single social link attached to a group.
 */
export type GroupSocialLink = {
  platform: string;
  url: string;
};

/**
 * Validated payload for creating a group.
 */
export type GroupCreateInput = {
  name: string;
  join_policy: GroupJoinPolicy;
  social: GroupSocialLink[];
};

/**
 * Validated payload for updating a group. All fields are optional; omitted
 * fields are left unchanged.
 */
export type GroupUpdateInput = {
  name?: string;
  join_policy?: GroupJoinPolicy;
  social?: GroupSocialLink[];
};

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
 * Validates and trims a group name.
 *
 * @param value - Candidate name.
 * @returns The trimmed name.
 * @throws ValidationError If the value is not a string or is not 1–64
 *   characters (counted by code points, not UTF-16 units).
 */
function validateName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Group name must be a string');
  }

  const name = value.trim();
  const length = [...name].length;

  if (length < 1 || length > 64) {
    throw new ValidationError('Group name must contain 1–64 characters');
  }

  return name;
}

/**
 * Validates a join policy value.
 *
 * @param value - Candidate policy.
 * @returns The policy if it is one of `open`, `approval`, or `invite`.
 * @throws ValidationError If the value is not a valid policy.
 */
function validatePolicy(value: unknown): GroupJoinPolicy {
  if (value !== 'open' && value !== 'approval' && value !== 'invite') {
    throw new ValidationError('Invalid join policy');
  }

  return value;
}

/**
 * Validates an array of social links.
 *
 * @remarks
 * Each link must be an object containing only `platform` and `url`.
 * `platform` must be a string of 1–64 code points after trimming.
 * `url` must be a string of 1–2048 characters, parseable as a URL, using
 * the `http:` or `https:` protocol, with a non-empty hostname and no
 * embedded username or password. The trimmed values are returned.
 *
 * @param value - Candidate value.
 * @returns Array of validated social links.
 * @throws ValidationError If the array or any link is invalid, or if more
 *   than 10 links are supplied.
 */
function validateSocial(value: unknown): GroupSocialLink[] {
  if (!Array.isArray(value)) {
    throw new ValidationError('social must be an array');
  }

  if (value.length > 10) {
    throw new ValidationError('Maximum 10 social links');
  }

  return value.map((item) => {
    const link = requireObject(item, 'Social link');

    rejectUnknownFields(link, ['platform', 'url']);

    if (typeof link.platform !== 'string') {
      throw new ValidationError('Social link platform must be a string');
    }

    const platform = link.platform.trim();

    if ([...platform].length < 1 || [...platform].length > 64) {
      throw new ValidationError('Social link platform must contain 1–64 characters');
    }

    if (typeof link.url !== 'string') {
      throw new ValidationError('Social link URL must be a string');
    }

    const url = link.url.trim();

    if (!url || url.length > 2048) {
      throw new ValidationError('Social link URL must contain 1–2048 characters');
    }

    let parsed: URL;

    try {
      parsed = new URL(url);
    } catch {
      throw new ValidationError('Social link URL must be an absolute HTTP or HTTPS URL');
    }

    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      throw new ValidationError(
        'Social link URL must use HTTP or HTTPS without embedded credentials',
      );
    }

    // Preserve the trimmed submitted URL.
    return { platform, url };
  });
}

/**
 * Reads and parses a request body as a JSON object.
 *
 * @param request - Incoming request.
 * @returns The parsed body as a plain object.
 * @throws ValidationError If the body is not valid JSON or is not a plain
 *   object.
 */
export async function readGroupBody(request: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  return requireObject(parsed, 'Request body');
}

/**
 * Validates a payload for creating a group.
 *
 * @remarks
 * Unknown fields are rejected. `name` is required. `join_policy` defaults
 * to `open` when omitted. `social` defaults to an empty array when omitted.
 *
 * @param value - Candidate payload.
 * @returns Validated create input.
 * @throws ValidationError If the payload is invalid.
 */
export function validateGroupCreate(value: unknown): GroupCreateInput {
  const body = requireObject(value, 'Request body');

  rejectUnknownFields(body, ['name', 'join_policy', 'social']);

  return {
    name: validateName(body.name),

    // Defaults apply only when the field is omitted.
    join_policy: body.join_policy === undefined ? 'open' : validatePolicy(body.join_policy),

    social: body.social === undefined ? [] : validateSocial(body.social),
  };
}

/**
 * Validates a payload for updating a group.
 *
 * @remarks
 * Unknown fields are rejected. Each recognized field is validated only if
 * present; omitted fields are left out of the result. At least one
 * recognized field must be present.
 *
 * @param value - Candidate payload.
 * @returns Validated update input containing only the fields that were
 *   supplied.
 * @throws ValidationError If the payload is invalid or contains no
 *   recognized fields.
 */
export function validateGroupUpdate(value: unknown): GroupUpdateInput {
  const body = requireObject(value, 'Request body');

  rejectUnknownFields(body, ['name', 'join_policy', 'social']);

  const result: GroupUpdateInput = {};

  if (body.name !== undefined) {
    result.name = validateName(body.name);
  }

  if (body.join_policy !== undefined) {
    result.join_policy = validatePolicy(body.join_policy);
  }

  if (body.social !== undefined) {
    result.social = validateSocial(body.social);
  }

  if (Object.keys(result).length === 0) {
    throw new ValidationError('Nothing to update');
  }

  return result;
}
