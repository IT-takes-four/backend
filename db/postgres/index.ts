import { drizzle } from "drizzle-orm/bun-sql";
// import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";
import { getConfig } from "@/config";

const { postgresUrl } = getConfig();

if (!postgresUrl) {
  throw new Error("POSTGRES_URL is not set");
}

export const db = drizzle(postgresUrl, { schema });

export * from "./schema";
