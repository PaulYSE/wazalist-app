import { ValidationError } from "../validation";

/**
 * @brief Parses stored progress markings into a safe six-boolean array.
 *
 * Invalid JSON or an invalid stored shape falls back to six false values.
 *
 * @param {unknown} value - Stored progress.markings database value.
 * @return {boolean[]} Exactly six Boolean marking values.
 */
const parseStoredMarkings = (value: unknown): boolean[] => {
	if (typeof value !== "string") {
		return Array(6).fill(false);
	}

	try {
		const parsed: unknown = JSON.parse(value);

		if (
			Array.isArray(parsed) &&
			parsed.length === 6 &&
			parsed.every(
				(marking) => typeof marking === "boolean",
			)
		) {
			return parsed;
		}
	} catch {
		// Invalid stored JSON falls back to empty markings.
	}

	return Array(6).fill(false);
};

/**
 * @brief Validates and normalizes a submitted markings JSON string.
 *
 * The current frontend API contract submits markings as serialized JSON.
 * The decoded value must contain exactly six booleans.
 *
 * @param {unknown} value - Submitted markings value.
 * @return {string} Canonical serialized six-boolean markings array.
 * @throws {ValidationError} If the value is missing or malformed.
 */
const validateSubmittedMarkings = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new ValidationError(
      "markings must be a JSON string containing exactly six booleans",
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ValidationError(
      "markings must be valid JSON",
    );
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length !== 6 ||
    !parsed.every((marking) => typeof marking === "boolean")
  ) {
    throw new ValidationError(
      "markings must contain exactly six booleans",
    );
  }

  return JSON.stringify(parsed);
};
