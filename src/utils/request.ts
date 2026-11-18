/**
 * request.ts — Helpers for reading and validating JSON request bodies.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import { ValidationError } from '../validation';

/**
 * Reads and validates a JSON request body as an object.
 *
 * @remarks
 * Rejects malformed JSON, `null`, arrays, and primitive JSON values.
 *
 * @param request - Incoming HTTP request.
 * @returns Parsed JSON object.
 * @throws ValidationError If the body is malformed or is not an object.
 */
export const readJsonObject = async (request: Request): Promise<Record<string, unknown>> => {
  let parsed: unknown;

  try {
    parsed = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('Request body must be an object');
  }

  return parsed as Record<string, unknown>;
};
