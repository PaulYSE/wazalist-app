/**
 * request.ts — Shared request context type passed from the main Worker
 * entry point to each route handler.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { User } from '../auth';

/**
 * Per-request context handed to every route handler.
 *
 * @remarks
 * Bundles the raw request, environment bindings, parsed URL, and path,
 * plus two helpers derived from the current session: `getUser` resolves
 * the authenticated user (or `null`), and `getGroupRole` looks up the
 * caller's role within a specific group.
 */
export interface RequestContext {
  /** Incoming HTTP request. */
  request: Request;

  /** Cloudflare Workers environment bindings. */
  env: Env;

  /** Parsed request URL. */
  url: URL;

  /** Pathname of the request URL. */
  path: string;

  /**
   * Resolves the authenticated user for this request.
   *
   * @returns The user, or `null` when there is no valid session. May also
   *   return `null` synchronously when no token was supplied.
   */
  getUser: () => Promise<User | null> | null;

  /**
   * Looks up a user's role within a group.
   *
   * @param groupId - Group to look up.
   * @param userId - User whose role should be resolved.
   * @returns The role string, or `null` if the user is not a member.
   */
  getGroupRole: (groupId: number, userId: number) => Promise<string | null>;
}
