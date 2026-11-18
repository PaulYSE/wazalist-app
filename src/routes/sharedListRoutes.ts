import type {
  RequestContext,
} from "../types/request";

import {
  SharedListBodyError,
  hashSharedList,
  readSharedListBody,
  validateSharedList,
} from "../sharedListValidation";

import {
  ValidationError,
} from "../validation";

import {
  err,
  json,
} from "../utils/responses";

/**
 * Handles shared-list API routes.
 *
 * @param ctx Shared request context.
 * @return A response when a shared-list route matches, otherwise null.
 */
export async function handleSharedListRoutes(
  ctx: RequestContext,
): Promise<Response | null> {
  const {
    request,
    env,
    path,
  } = ctx;

  // ── Store shared list ─────────────────────────────────────
  if (
    path === "/api/list" &&
    request.method === "POST"
  ) {
    try {
      const body = await readSharedListBody(request);
      const { key, data } = body;

      if (
        typeof key !== "string" ||
        !/^[0-9a-f]{64}$/.test(key)
      ) {
        throw new ValidationError(
          "Invalid key format",
        );
      }

      if (typeof data !== "string") {
        throw new ValidationError(
          "data must be a JSON string",
        );
      }

      if (
        new TextEncoder().encode(data).byteLength >
        524288
      ) {
        return err(
          "Shared list payload is too large",
          413,
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(data);
      } catch {
        throw new ValidationError(
          "Shared list must be valid JSON",
        );
      }

      validateSharedList(parsed);

      const expectedKey =
        await hashSharedList(data);

      if (key !== expectedKey) {
        throw new ValidationError(
          "Shared list key does not match its contents",
        );
      }

      await env.LIST_STORE.put(
        key,
        data,
        {
          expirationTtl: 60 * 60 * 24 * 90,
        },
      );

      return json({
        success: true,
        key,
      });
    } catch (error) {
      if (error instanceof SharedListBodyError) {
        return err(
          error.message,
          error.status,
        );
      }

      if (error instanceof ValidationError) {
        return err(error.message, 400);
      }

      console.error(
        "Shared list upload failed:",
        error,
      );

      return err(
        "Could not store the shared list",
        500,
      );
    }
  }

  return null;
}
