import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, apiKey, openAPI } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";

import { db } from "@/db/postgres";
import { getConfig } from "@/config";

const { trustedOrigins, isDev } = getConfig();

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
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
