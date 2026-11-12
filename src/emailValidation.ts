import { ValidationError } from "./validation";

const MAX_EMAIL_LENGTH = 254;

/**
 * Normalizes and validates an email address for account recovery.
 *
 * Trims surrounding whitespace and converts the result to lowercase.
 * Rejects control characters, internal whitespace, missing or repeated
 * at-signs, empty local/domain portions, and malformed domain labels.
 *
 * This validates syntax only. It does not verify ownership or delivery.
 *
 * @param value Email value to normalize.
 * @return Normalized lowercase email.
 * @throws ValidationError If the value is not a valid recovery email.
 */
export function normalizeRecoveryEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError(
      "Recovery email must be a string",
    );
  }

  const email = value.trim().toLowerCase();

  if (!email || email.length > MAX_EMAIL_LENGTH) {
    throw new ValidationError(
      "Recovery email is invalid",
    );
  }

  // Reject ASCII control characters, DEL, and whitespace.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0020\u007f]/.test(email)) {
    throw new ValidationError(
      "Recovery email is invalid",
    );
  }

  const parts = email.split("@");

  if (parts.length !== 2) {
    throw new ValidationError(
      "Recovery email is invalid",
    );
  }

  const [localPart, domain] = parts;

  if (
    !localPart ||
    !domain ||
    localPart.length > 64 ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..")
  ) {
    throw new ValidationError(
      "Recovery email is invalid",
    );
  }

  const domainLabels = domain.split(".");

  if (
    domainLabels.length < 2 ||
    domainLabels.some(
      (label) =>
        !label ||
        label.length > 63 ||
        label.startsWith("-") ||
        label.endsWith("-") ||
        !/^[a-z0-9-]+$/.test(label),
    )
  ) {
    throw new ValidationError(
      "Recovery email is invalid",
    );
  }

  return email;
}

/**
 * Checks whether a value is a syntactically valid recovery email.
 *
 * @param value Candidate email value.
 * @return Whether normalizeRecoveryEmail accepts the value.
 */
export function isValidRecoveryEmail(
  value: unknown,
): boolean {
  try {
    normalizeRecoveryEmail(value);
    return true;
  } catch {
    return false;
  }
}
