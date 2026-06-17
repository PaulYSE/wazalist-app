/**
 * @file groups.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Group-related API helpers. Fetching and regenerating invite keys.
 */

import { api } from './api.js';

/**
 * @brief Fetches the current invite key for a group.
 *
 * @param {number} groupId - The group ID.
 * @return {Promise<string|null>} The invite key string, or null on failure.
 */
export async function getGroupInviteKey(groupId) {
  try {
    const res = await api('/api/groups/' + groupId + '/invite-key');
    if (res.error) return null;
    return res.invite_key;
  } catch {
    return null;
  }
}

/**
 * @brief Regenerates a new invite key for a group.
 *
 * Invalidates the old key immediately.
 *
 * @param {number} groupId - The group ID.
 * @return {Promise<string|null>} The new invite key string, or null on failure.
 */
export async function createGroupInviteKey(groupId) {
  try {
    const res = await api('/api/groups/' + groupId + '/invite-key', 'POST');
    if (res.error) return null;
    return res.invite_key;
  } catch {
    return null;
  }
}
