import type { EmailDeliveryResult, EmailMessage, EmailProvider } from "./emailProvider";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";

type ResendSuccessResponse = { id?: unknown; };

type ResendErrorResponse = { message?: unknown;name?: unknown; };

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  constructor(apiKey: string){this.apiKey = apiKey;}

async send(message: EmailMessage): Promise<EmailDeliveryResult> {
    // Check API key
    if (!this.apiKey) {
      return {
        success: false,
        error: "Resend API key is not configured",
      };
    }

    let response: Response;

    try {
      response = await fetch(RESEND_EMAIL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + this.apiKey,
          "Content-Type": "application/json",
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
      console.error(
        "Resend network request failed:",
        safeErrorMessage(error)
      );
      return {
        success: false,
        error: "The email provider could not be reached",
      };
    }

  let data: unknown = null;

  try{data = await response.json();}
  catch{
    if(response.ok){
      return{
        success: false,
        error: "The email provider returned an invalid success response",
      };
    }
  }
  if(!response.ok){
    const providerError = readResendError(data);
    console.error("Resend rejected the email request:",response.status,providerError,);
    return{success: false,error: "The email provider rejected the request",};}

  const messageId = readResendMessageId(data);

  if(!messageId){
    return{success: false, error: "The email provider did not confirm the message",};}
  return{ success: true, providerMessageId: messageId,};}}

/**
 * Safely reads the Resend message ID from an unknown value.
 * Returns null if the value is not a valid object or the ID is missing/invalid.
 */
function readResendMessageId(value: unknown): string | null {
  // Ensure value is a non-null object and not an array
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const data = value as ResendSuccessResponse;

  // Validate that `id` is a non-empty string
  if (typeof data.id === "string" && data.id.trim().length > 0) {
    return data.id.trim();
  }

  return null;
}

function readResendError(value: unknown): string {
  // Check if value is a non-null object and not an array
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return "Unknown provider error";
  }

  const data = value as ResendErrorResponse;

  // Check message field
  if (typeof data.message === "string" && data.message.trim()) {
    return data.message;
  }

  // Check name field
  if (typeof data.name === "string" && data.name.trim()) {
    return data.name;
  }

  // Fallback
  return "Unknown provider error";
}

/**
 * Safely extracts an error message from any unknown value.
 * Falls back to a default message if the value is not an Error.
 *
 * @param value - The unknown value that might be an Error.
 * @returns A string describing the error.
 */
function safeErrorMessage(value: unknown): string {
  try {
    if (value instanceof Error) {
      return value.message || "An error occurred";
    }

    // Handle string errors thrown directly
    if (typeof value === "string") {
      return value;
    }

    // Handle objects with a 'message' property
    if (
      typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof (value as any).message === "string"
    ) {
      return (value as any).message;
    }

    // Fallback message
    return "Unknown network error";
  } catch {
    // In case something goes wrong during inspection
    return "Unknown network error";
  }
}
