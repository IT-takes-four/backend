import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, admin, apiKey, openAPI } from "better-auth/plugins";
import { passkey } from "better-auth/plugins/passkey";

import { db } from "@/db/postgres";

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
  trustedOrigins: [
    "http://localhost:3030",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
});
