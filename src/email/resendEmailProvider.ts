/**
 * resendEmailProvider.ts — Resend implementation of the `EmailProvider`
 * interface.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { EmailDeliveryResult, EmailMessage, EmailProvider } from './emailProvider';

/**
 * Resend API endpoint for sending email.
 */
const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Shape of a successful Resend response. `id` is typed as `unknown`
 * because the field is validated at runtime by `readResendMessageId`.
 */
type ResendSuccessResponse = { id?: unknown };

/**
 * Shape of a Resend error response. Both fields are typed as `unknown`
 * because they are validated at runtime by `readResendError`.
 */
type ResendErrorResponse = { message?: unknown; name?: unknown };

/**
 * `EmailProvider` implementation that delivers email through Resend's
 * HTTP API.
 */
export class ResendEmailProvider implements EmailProvider {
  /**
   * Resend API key used to authenticate requests.
   */
  private readonly apiKey: string;

  /**
   * Creates a new provider bound to the given Resend API key.
   *
   * @param apiKey - Resend API key.
   */
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Sends an email through the Resend HTTP API.
   *
   * @remarks
   * Returns a failure result (rather than throwing) when the API key is
   * missing, the network request fails, Resend returns a non-2xx status, or
   * the response does not include a usable message ID. The `to` field is
   * wrapped in an array because Resend expects an array of recipients.
   *
   * @param message - Email to send.
   * @returns Delivery result containing the Resend message ID on success,
   *   or an error description on failure.
   */
  async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    // Check API key
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Resend API key is not configured',
      };
    }

    let response: Response;

    try {
      response = await fetch(RESEND_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from,
          to: [message.to], // Resend expects an array
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
    } catch (error) {
      console.error('Resend network request failed:', safeErrorMessage(error));
      return {
        success: false,
        error: 'The email provider could not be reached',
      };
    }

    let data: unknown = null;

    try {
      data = await response.json();
    } catch {
      if (response.ok) {
        return {
          success: false,
          error: 'The email provider returned an invalid success response',
        };
      }
    }
    if (!response.ok) {
      const providerError = readResendError(data);
      console.error('Resend rejected the email request:', response.status, providerError);
      return { success: false, error: 'The email provider rejected the request' };
    }

    const messageId = readResendMessageId(data);

    if (!messageId) {
      return { success: false, error: 'The email provider did not confirm the message' };
    }
    return { success: true, providerMessageId: messageId };
  }
}

/**
 * Safely reads the Resend message ID from an unknown value.
 *
 * @remarks
 * Returns `null` if the value is not a non-array object or if its `id`
 * field is not a non-empty string. The returned ID is trimmed.
 *
 * @param value - Value to inspect (typically a parsed JSON response).
 * @returns The trimmed message ID, or `null` if missing or invalid.
 */
function readResendMessageId(value: unknown): string | null {
  // Ensure value is a non-null object and not an array
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const data = value as ResendSuccessResponse;

  // Validate that `id` is a non-empty string
  if (typeof data.id === 'string' && data.id.trim().length > 0) {
    return data.id.trim();
  }

  return null;
}

/**
 * Extracts a human-readable error message from a Resend error response.
 *
 * @remarks
 * Prefers the response's `message` field, falls back to `name`, and
 * returns the literal `'Unknown provider error'` if the value is not an
 * object or neither field is a non-empty string.
 *
 * @param value - Value to inspect (typically a parsed JSON response).
 * @returns A descriptive error string, never empty.
 */
function readResendError(value: unknown): string {
  // Check if value is a non-null object and not an array
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return 'Unknown provider error';
  }

  const data = value as ResendErrorResponse;

  // Check message field
  if (typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  // Check name field
  if (typeof data.name === 'string' && data.name.trim()) {
    return data.name;
  }

  // Fallback
  return 'Unknown provider error';
}

/**
 * Safely extracts an error message from any unknown value.
 *
 * @remarks
 * Handles `Error` instances, plain strings, and objects with a string
 * `message` property. Falls back to `'Unknown network error'` for
 * anything else, including when inspecting the value throws.
 *
 * @param value - The unknown value that might be an Error.
 * @returns A string describing the error.
 */
function safeErrorMessage(value: unknown): string {
  try {
    if (value instanceof Error) {
      return value.message || 'An error occurred';
    }

    // Handle string errors thrown directly
    if (typeof value === 'string') {
      return value;
    }

    // Handle objects with a 'message' property
    if (
      typeof value === 'object' &&
      value !== null &&
      'message' in value &&
      typeof value.message === 'string'
    ) {
      return value.message;
    }

    // Fallback message
    return 'Unknown network error';
  } catch {
    // In case something goes wrong during inspection
    return 'Unknown network error';
  }
}
