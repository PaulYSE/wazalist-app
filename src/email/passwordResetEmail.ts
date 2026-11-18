/**
 * passwordResetEmail.ts — Builds the password-reset email message (text and
 * HTML) from caller-supplied reset details.
 *
 * @remarks
 * Author: Paul Yong Shao En
 * Contact: \<paulyse99\@gmail.com\>
 * Project: Wazalist App
 * Date: 2026-11-18
 */
import type { EmailMessage } from './emailProvider';

/**
 * Inputs used to build a password-reset email.
 */
export type PasswordResetEmailOptions = {
  /** Sender email address */
  from: string;

  /** Recipient email address */
  to: string;

  /** URL for resetting the password */
  resetUrl: string;

  /** Number of hours before the reset link expires */
  expiresHours: number;
};

/**
 * Builds a password-reset email message containing both plain-text and
 * HTML bodies.
 *
 * @remarks
 * The plain-text body and the HTML body both include the reset URL and the
 * expiry duration. The URL and expiry are passed through `escapeHtml`
 * before being interpolated into the HTML body.
 *
 * @param options - Reset details used to populate the message.
 * @returns An `EmailMessage` with `from`, `to`, `subject`, `text`, and
 *   `html` fields populated.
 */
export function buildPasswordResetEmail(options: PasswordResetEmailOptions): EmailMessage {
  const { from, to, resetUrl, expiresHours } = options;
  const subject = 'Reset your Wazalist password';
  const text = [
    'A request was made to reset your Wazalist password.',
    '',
    'Use the following link to create a new password:',
    resetUrl,
    '',
    `This link is valid for ${expiresHours} hours and can only be used once.`,
    '',
    'If you did not request this password reset, you can ignore this email.',
    'Your password has not been changed.',
  ].join('\n');
  const safeResetUrl = escapeHtml(resetUrl);
  const safeExpiry = escapeHtml(String(expiresHours));
  const html = [
    '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto">',
    '<h1 style="font-size:22px;margin:0 0 16px">Reset your Wazalist password</h1>',
    '<p style="margin:0 0 16px">A request was made to reset your Wazalist password.</p>',
    '<p style="margin:24px 0">',
    `<a href="${safeResetUrl}" style="display:inline-block;padding:11px 18px;border-radius:7px;background:#5a4fd0;color:#ffffff;text-decoration:none;font-weight:600">Reset password</a>`,
    '</p>',
    `<p style="margin:0 0 16px">This link is valid for <strong>${safeExpiry} hours</strong> and can only be used once.</p>`,
    '<p style="margin:0 0 6px;color:#4b5563">If you did not request this password reset, you can ignore this email.</p>',
    '<p style="margin:0;color:#4b5563">Your password has not been changed.</p>',
    '<hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">',
    '<p style="margin:0;font-size:12px;color:#6b7280">Wazalist App by IFX</p>',
    '</div>',
  ].join('');
  return {
    from,
    to,
    subject,
    text,
    html,
  };
}

/**
 * Escapes special HTML characters in a string to prevent HTML injection.
 *
 * @remarks
 * Replaces `&`, `<`, `>`, `"`, and `'` with their HTML entities. Returns an
 * empty string when the input is `null` or `undefined`.
 *
 * @param value - The input string to escape.
 * @returns The escaped string safe for HTML rendering.
 */
function escapeHtml(value: string): string {
  if (value === null || value === undefined) {
    return ''; // Return empty string for null/undefined
  }

  return value
    .replace(/&/g, '&amp;') // Escape ampersand
    .replace(/</g, '&lt;') // Escape less-than
    .replace(/>/g, '&gt;') // Escape greater-than
    .replace(/"/g, '&quot;') // Escape double quotes
    .replace(/'/g, '&#39;'); // Escape single quotes
}
