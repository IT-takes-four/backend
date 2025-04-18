import { drizzle } from "drizzle-orm/bun-sql";
// import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

const dbUrl = process.env.POSTGRES_URL;

if (!dbUrl) {
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(dbUrl, { schema });

export * from "./schema";
