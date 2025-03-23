import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

import * as schema from "./schema";

const dbPath = process.env.SQLITE_DATABASE_URL || "games.db";
const sqlite = new Database(dbPath);
sqlite.run("PRAGMA foreign_keys = ON"); // Critical for foreign key constraints
sqlite.run("PRAGMA journal_mode = WAL"); // Better concurrency for read/write operations
sqlite.run("PRAGMA synchronous = NORMAL"); // Good balance of safety and speed

// Performance optimizations
sqlite.run("PRAGMA cache_size = -20000"); // ~20MB cache
sqlite.run("PRAGMA temp_store = MEMORY"); // Store temp tables in memory
sqlite.run("PRAGMA mmap_size = 536870912"); // Memory-map up to 512MB

export const db = drizzle(sqlite, { schema });

export * from "./schema";
