/**
 * emailValidation.ts — Email address normalization and validation utilities
 * for account recovery flows.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

import { ValidationError } from './validation';

const MAX_EMAIL_LENGTH = 254;

/**
 * Normalizes and validates an email address for account recovery.
 *
 * @remarks
 * Trims surrounding whitespace and converts the result to lowercase.
 * Rejects:
 * - non-string input
 * - empty strings and values longer than 254 characters
 * - ASCII control characters, DEL, and whitespace
 * - anything without exactly one `@` (missing or repeated at-signs)
 * - an empty local part or domain
 * - a local part longer than 64 characters
 * - a local part starting with `.`, ending with `.`, or containing `..`
 * - a domain with fewer than 2 labels (e.g. `localhost` is rejected)
 * - any domain label that is empty, longer than 63 characters, starts or
 *   ends with `-`, or contains characters outside `[a-z0-9-]`
 *
 * This validates syntax only. It does not verify ownership or delivery.
 *
 * @param value - Email value to normalize.
 * @returns Normalized lowercase email.
 * @throws ValidationError If the value is not a valid recovery email.
 */
export function normalizeRecoveryEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Recovery email must be a string');
  }

  const email = value.trim().toLowerCase();

  if (!email || email.length > MAX_EMAIL_LENGTH) {
    throw new ValidationError('Recovery email is invalid');
  }

  // Reject ASCII control characters, DEL, and whitespace.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f]/.test(email)) {
    throw new ValidationError('Recovery email is invalid');
  }

  const parts = email.split('@');

  if (parts.length !== 2) {
    throw new ValidationError('Recovery email is invalid');
  }

  const [localPart, domain] = parts;

  if (
    !localPart ||
    !domain ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..')
  ) {
    throw new ValidationError('Recovery email is invalid');
  }

  const domainLabels = domain.split('.');

  if (
    domainLabels.length < 2 ||
    domainLabels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith('-') ||
        label.endsWith('-') ||
        !/^[a-z0-9-]+$/.test(label),
    )
  ) {
    throw new ValidationError('Recovery email is invalid');
  }

  return email;
}

/**
 * Checks whether a value is a syntactically valid recovery email.
 *
 * @remarks
 * Returns `true` if `normalizeRecoveryEmail` completes without throwing,
 * and `false` if it throws any error.
 *
 * @param value - Candidate email value.
 * @returns `true` if the value passes `normalizeRecoveryEmail`, otherwise
 *   `false`.
 */
export function isValidRecoveryEmail(value: unknown): boolean {
  try {
    normalizeRecoveryEmail(value);
    return true;
  } catch {
    return false;
  }
}
