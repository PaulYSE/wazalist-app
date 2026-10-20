/**
 * Validates an API response as an array.
 *
 * Accepts empty arrays and returns the original array without validating
 * its elements. Rejects responses containing a nonblank string error
 * before checking whether the response is an array.
 *
 * @param {*} value API response to validate.
 * @param {string} fallbackMessage Error message used when the response
 *     is not an array and has no nonblank string API error.
 * @return {!Array<*>} Original response array, unchanged.
 * @throws {!Error} If the response contains a nonblank string error or
 *     is not an array. Uses the API error message when present;
 *     otherwise uses fallbackMessage.
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
 * Validates an API response as a non-null, non-array object.
 *
 * Accepts empty objects and returns the original object without
 * validating its properties. Rejects responses containing a nonblank
 * string error before checking the response type.
 *
 * @param {*} value API response to validate.
 * @param {string} fallbackMessage Error message used when the response
 *     is null, an array, or a non-object value and has no nonblank
 *     string API error.
 * @return {!Object} Original response object, unchanged.
 * @throws {!Error} If the response contains a nonblank string error,
 *     is null, is an array, or is not an object. Uses the API error
 *     message when present; otherwise uses fallbackMessage.
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
