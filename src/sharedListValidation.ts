/**
 * sharedListValidation.ts — Validation, hashing, and size-limited body
 * reading for version 1 shared-list uploads.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import { ValidationError, requireObject } from './validation';

/**
 * Validates version 1 shared-list data without modifying it.
 *
 * @remarks
 * The input must be a plain object with only `v`, `labels`, and `marks`.
 * `v` must equal `1`. `labels` must be an array of exactly six strings.
 * `marks` must be an object whose keys are canonical positive integer
 * Waza IDs (no leading zeros, within the safe-integer range). Each value
 * must be an object containing only `markings` (exactly six booleans) and
 * `like` (`null`, `1`, or `-1`).
 *
 * @param value - Candidate shared-list value.
 * @throws ValidationError If the value does not conform to the version 1
 *   schema.
 */
export function validateSharedList(value: unknown): void {
  const list = requireObject(value, 'Shared list');

  const allowedFields = new Set(['v', 'labels', 'marks']);
  if (Object.keys(list).some((field) => !allowedFields.has(field))) {
    throw new ValidationError('Shared list contains an unsupported field');
  }

  if (list.v !== 1) {
    throw new ValidationError('Unsupported shared list version');
  }

  if (
    !Array.isArray(list.labels) ||
    list.labels.length !== 6 ||
    !list.labels.every((label) => typeof label === 'string')
  ) {
    throw new ValidationError('labels must contain exactly six strings');
  }

  const marks = requireObject(list.marks, 'marks');

  for (const [id, value] of Object.entries(marks)) {
    // Require canonical positive integer IDs.
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      throw new ValidationError('marks contains an invalid Waza ID');
    }

    const progress = requireObject(value, 'Progress entry');

    if (Object.keys(progress).some((field) => field !== 'markings' && field !== 'like')) {
      throw new ValidationError('Progress entry contains an unsupported field');
    }

    if (
      !Array.isArray(progress.markings) ||
      progress.markings.length !== 6 ||
      !progress.markings.every((marking) => typeof marking === 'boolean')
    ) {
      throw new ValidationError('markings must contain exactly six booleans');
    }

    if (progress.like !== null && progress.like !== 1 && progress.like !== -1) {
      throw new ValidationError('like must be null, 1, or -1');
    }
  }
}

/**
 * Hashes the exact submitted string, without reserializing its JSON.
 *
 * @remarks
 * Hashes the raw string bytes with SHA-256 so the digest matches the
 * client-submitted data exactly, even when whitespace or key order differs
 * from a canonical reserialization.
 *
 * @param data - Raw submitted string.
 * @returns Lowercase hexadecimal SHA-256 digest.
 */
export async function hashSharedList(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Suggested outer request limit: 4 MiB.
 *
 * @remarks
 * The serialized data string has its own 512 KiB limit in `index.ts`.
 * The outer JSON can be larger because it escapes characters inside
 * `data`.
 */
const MAX_UPLOAD_BODY_BYTES = 4 * 1024 * 1024;

/**
 * Error carrying an HTTP status code for shared-list body failures.
 *
 * @remarks
 * Extends `ValidationError` so callers that already handle validation
 * errors still catch these, while `status` lets the route layer pick the
 * correct response code (`400` or `413`).
 */
export class SharedListBodyError extends ValidationError {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SharedListBodyError';
    this.status = status;
  }
}

/**
 * Reads an upload body with an enforced byte limit.
 *
 * @remarks
 * `Content-Length` is an early check only; the actual stream is counted
 * independently, including when `Content-Length` is missing. The body is
 * read in chunks, rejected with a `413` as soon as it exceeds
 * `MAX_UPLOAD_BODY_BYTES`, and then decoded as strict UTF-8 JSON. Any
 * failure while reading the stream is surfaced as a `400`.
 *
 * @param request - Incoming request.
 * @returns Parsed body as a plain object.
 * @throws SharedListBodyError With `status` `400` or `413` if the body is
 *   invalid, unreadable, or too large.
 */
export async function readSharedListBody(request: Request): Promise<Record<string, unknown>> {
  const contentLength = request.headers.get('Content-Length');

  if (contentLength !== null) {
    const declaredLength = Number(contentLength);

    if (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(declaredLength)) {
      throw new SharedListBodyError('Invalid Content-Length', 400);
    }

    if (declaredLength > MAX_UPLOAD_BODY_BYTES) {
      throw new SharedListBodyError('Upload request is too large', 413);
    }
  }

  if (!request.body) {
    throw new SharedListBodyError('Request body is required', 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_UPLOAD_BODY_BYTES) {
        // Stop consuming the oversized request.
        try {
          await reader.cancel();
        } catch {
          // Cancellation failure must not hide the size-limit error.
        }

        throw new SharedListBodyError('Upload request is too large', 413);
      }

      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof SharedListBodyError) {
      throw error;
    }

    throw new SharedListBodyError('Could not read upload request', 400);
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;

  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
    parsed = JSON.parse(text);
  } catch {
    throw new SharedListBodyError('Request body must be valid UTF-8 JSON', 400);
  }

  return requireObject(parsed, 'Request body');
}
