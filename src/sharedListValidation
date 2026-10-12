import { ValidationError, requireObject } from "./validation";

/**
 * Validates version 1 shared-list data without modifying it.
 */
export function validateSharedList(value: unknown): void {
  const list = requireObject(value, "Shared list");

  const allowedFields = new Set(["v", "labels", "marks"]);
  if (Object.keys(list).some((field) => !allowedFields.has(field))) {
    throw new ValidationError("Shared list contains an unsupported field");
  }

  if (list.v !== 1) {
    throw new ValidationError("Unsupported shared list version");
  }

  if (
    !Array.isArray(list.labels) ||
    list.labels.length !== 6 ||
    !list.labels.every((label) => typeof label === "string")
  ) {
    throw new ValidationError("labels must contain exactly six strings");
  }

  const marks = requireObject(list.marks, "marks");

  for (const [id, value] of Object.entries(marks)) {
    // Require canonical positive integer IDs.
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
      throw new ValidationError("marks contains an invalid Waza ID");
    }

    const progress = requireObject(value, "Progress entry");

    if (
      Object.keys(progress).some(
        (field) => field !== "markings" && field !== "like",
      )
    ) {
      throw new ValidationError("Progress entry contains an unsupported field");
    }

    if (
      !Array.isArray(progress.markings) ||
      progress.markings.length !== 6 ||
      !progress.markings.every((marking) => typeof marking === "boolean")
    ) {
      throw new ValidationError(
        "markings must contain exactly six booleans",
      );
    }

    if (
      progress.like !== null &&
      progress.like !== 1 &&
      progress.like !== -1
    ) {
      throw new ValidationError("like must be null, 1, or -1");
    }
  }
}

/**
 * Hashes the exact submitted string, without reserializing its JSON.
 */
export async function hashSharedList(data: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
