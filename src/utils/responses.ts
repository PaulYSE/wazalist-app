/**
 * responses.ts — Helpers for building JSON responses from the Worker.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Returns a JSON response.
 *
 * @remarks
 * Serializes `data` with `JSON.stringify` and sets
 * `Content-Type: application/json`. The HTTP status defaults to `200`.
 *
 * @param data - Value to serialize as the response body.
 * @param status - HTTP status code.
 * @returns A `Response` whose body is the JSON-encoded `data`.
 */
export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });

/**
 * Returns a JSON error response.
 *
 * @remarks
 * Wraps the message in `{ "error": message }` and delegates to `json`.
 * The HTTP status defaults to `400`.
 *
 * @param message - Error message to include in the body.
 * @param status - HTTP status code.
 * @returns A `Response` whose body is `{ "error": message }`.
 */
export const err = (message: string, status = 400): Response => json({ error: message }, status);
