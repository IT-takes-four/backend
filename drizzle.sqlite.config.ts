import { defineConfig } from "drizzle-kit";

const dbPath = process.env.SQLITE_DATABASE_URL || "./games.db";

export default defineConfig({
  schema: "./db/sqlite/schema/index.ts",
  out: "./db/sqlite/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
