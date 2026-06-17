/**
 * @file groups.js
 * @author Paul Yong Shao En
 * @email paulyse99@gmail.com
 * @project Wazalist App
 * @date 2026-06-17
 * @brief Configuration constants for group join policies. Maps policy keys to display labels and CSS classes.
 */

/**
 * @brief Human-readable labels for group join policies.
 *
 * @type {Object.<string, string>}
 */
export const POLICY_LABEL = {
  open: 'Open',
  approval: 'Approval',
  invite: 'Invite only',
};

/**
 * @brief CSS class names for group join policy badges.
 *
 * @type {Object.<string, string>}
 */
export const POLICY_CLASS = {
  open: 'cs-approved',
  approval: 'cs-pending',
  invite: 'ct-edit',
};
