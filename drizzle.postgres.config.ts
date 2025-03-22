import { defineConfig } from "drizzle-kit";

const dbUrl = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@localhost:5432/${process.env.POSTGRES_DB}`;

if (!dbUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: "./src/pg_db/schema.ts",
  out: "./src/pg_db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
