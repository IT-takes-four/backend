import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, apiKey, openAPI } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";

import { db } from "@/db/postgres";
import { getConfig } from "@/config";
import {
  resetPasswordEmailTemplate,
  sendEmail,
  sendVerificationEmailTemplate,
} from "@/utils/email";

const { trustedOrigins, isDev } = getConfig();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    resetPasswordTokenExpiresIn: 1 * 60 * 60 * 1000, // 1 hour
    verifyEmailTokenExpiresIn: 24 * 60 * 60 * 1000, // 24 hours
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset Your Password - Quokka",
        html: resetPasswordEmailTemplate(url),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify Your Email - Quokka",
        html: sendVerificationEmailTemplate(url),
      });
    },
  },
  passkey: {
    enabled: true,
  },
  plugins: [username(), passkey(), admin(), apiKey(), openAPI()],
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    const origin = request.headers.get("origin");

    if (!origin) return [];

    if (isDev && origin.startsWith("http://localhost")) {
      return [origin];
    }

    if (trustedOrigins.includes(origin)) {
      return [origin];
    }

    return [];
  },
});
