import { defineConfig } from "drizzle-kit";

const dbUrl = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/${process.env.POSTGRES_DB}`;

if (!dbUrl) {
  throw new Error("POSTGRES_URL is not set");
}

export default defineConfig({
  schema: "./db/postgres/schema.ts",
  out: "./db/postgres/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
