import { defineConfig } from "drizzle-kit";

const dbPath = process.env.SQLITE_DATABASE_URL || "./games.db";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
