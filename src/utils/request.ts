import { ValidationError } from "../validation";

/**
 * @brief Reads and validates a JSON request body as an object.
 *
 * Rejects malformed JSON, null, arrays, and primitive JSON values.
 *
 * @param {Request} request - Incoming HTTP request.
 * @return {Promise<Record<string, unknown>>} Parsed JSON object.
 * @throws {ValidationError} If the body is malformed or is not an object.
 */
const readJsonObject = async (
	request: Request,
): Promise<Record<string, unknown>> => {
	let parsed: unknown;

	try {
		parsed = await request.json();
	} catch {
		throw new ValidationError(
			"Request body must be valid JSON",
		);
	}

	if (
		parsed === null ||
		typeof parsed !== "object" ||
		Array.isArray(parsed)
	) {
		throw new ValidationError(
			"Request body must be an object",
		);
	}

	return parsed as Record<string, unknown>;
};
