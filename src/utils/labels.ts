export const EMPTY_LABELS = ["", "", "", "", "", ""];

/**
 * @brief Parses stored marking labels into a safe six-string array.
 *
 * Invalid JSON or an invalid stored shape falls back to six empty labels.
 *
 * @param {unknown} value - Stored shape_labels database value.
 * @return {string[]} Exactly six marking-label strings.
 */
export const parseStoredLabels = (value: unknown): string[] => {
  if (typeof value !== "string") {
    return [...EMPTY_LABELS];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (
      Array.isArray(parsed) &&
      parsed.length === 6 &&
      parsed.every((label) => typeof label === "string")
    ) {
      return parsed;
    }
  } catch {
    // Invalid stored JSON falls back to the default labels.
  }

  return [...EMPTY_LABELS];
};
