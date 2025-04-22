import { Resend } from "resend";

import { getConfig } from "@/config";

const { resendApiKey, isDev } = getConfig();

const resend = new Resend(resendApiKey);

export const resetPasswordEmailTemplate = (url: string) => `
    <h1>Reset Your Password</h1>
    <p>Hello,</p>
    <p>We received a request to reset your password for your playdamnit account. Click the button below to reset it:</p>
    <a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 16px 0;">Reset Password</a>
    <p>If you didn't request this, you can safely ignore this email.</p>
    <p>This link will expire in 1 hour.</p>
    <p>Best regards,<br>The playdamnit Team</p>
    <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser: ${url}</p>
`;

export const sendVerificationEmailTemplate = (url: string) => `
    <h1>Welcome to playdamnit.com!</h1>
    <p>Hello,</p>
    <p>Thanks for signing up! Please verify your email address by clicking the button below:</p>
    <a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 16px 0;">Verify Email</a>
    <p>If you didn't create an account with us, you can safely ignore this email.</p>
    <p>This link will expire in 24 hours.</p>
    <p>Best regards,<br>The playdamnit Team</p>
    <p style="color: #666; font-size: 12px;">If the button doesn't work, copy and paste this link into your browser: ${url}</p>
`;

export const sendEmail = async ({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) => {
  if (isDev) {
    console.log("==== Development Mode Email ====");
    console.log("To:", to);
    console.log("Subject:", subject);
    console.log("HTML:", html);
    console.log("==============================");
  }

  return resend.emails.send({
    from: isDev
      ? "onboarding@resend.dev"
      : "playdamnit.com <hello@playdamnit.com>",
    to: isDev ? "delivered@resend.dev" : to,
    subject,
    html,
  });
};
