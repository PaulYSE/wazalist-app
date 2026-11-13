/** Provider-independent transactional email message.
 */
export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type EmailDeliverySuccess = {
  success: true;
  providerMessageId: string | null;
};

export type EmailDeliveryFailure = {
  success: false;
  error: string;
};

export type EmailDeliveryResult = | EmailDeliverySuccess | EmailDeliveryFailure;

export interface EmailProvider { send( message: EmailMessage, ): Promise<EmailDeliveryResult>;}
