/**
 * Returns a JSON response.
 */
export const json = (
  data: unknown,
  status = 200,
): Response =>
  new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );

/**
 * Returns a JSON error response.
 */
export const err = (
  message: string,
  status = 400,
): Response =>
  json(
    { error: message },
    status,
  );
