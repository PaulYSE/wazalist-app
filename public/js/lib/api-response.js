/**
 * Rejects API error responses and unexpected array responses.
 * A valid empty array is accepted.
 */
export function requireApiArray(value, fallbackMessage) {
  if (
    value &&
    typeof value.error === 'string' &&
    value.error.trim()
  ) {
    throw new Error(value.error);
  }

  if (!Array.isArray(value)) {
    throw new Error(fallbackMessage);
  }

  return value;
}

/**
 * Rejects API error responses and unexpected object responses.
 */
export function requireApiObject(value, fallbackMessage) {
  if (
    value &&
    typeof value.error === 'string' &&
    value.error.trim()
  ) {
    throw new Error(value.error);
  }

  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new Error(fallbackMessage);
  }

  return value;
}
