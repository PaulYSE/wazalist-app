/**
 * emailProvider.ts — Provider-independent types describing transactional
 * email messages and delivery results.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */

/**
 * Provider-independent transactional email message.
 */
export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Successful email delivery result.
 *
 * @remarks
 * `providerMessageId` is `null` when the provider accepted the message but
 * did not return an identifier.
 */
export type EmailDeliverySuccess = {
  success: true;
  providerMessageId: string | null;
};

/**
 * Failed email delivery result.
 */
export type EmailDeliveryFailure = {
  success: false;
  error: string;
};

/**
 * Discriminated union of email delivery outcomes, keyed on `success`.
 */
export type EmailDeliveryResult = EmailDeliverySuccess | EmailDeliveryFailure;

/**
 * Sends an email message.
 *
 * @param message - Message to deliver.
 * @returns A delivery result; providers should return a failure result
 *   rather than throwing on expected errors.
 */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailDeliveryResult>;
}
