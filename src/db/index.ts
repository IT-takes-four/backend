import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const dbPath = process.env.SQLITE_DATABASE_URL || "games.db";
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite, { schema });

export * from "./schema";
