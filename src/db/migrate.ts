import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from ".";

// This will run migrations on the database, skipping the ones already applied
const runMigrations = async () => {
  try {
    console.log("Running migrations...");
    migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("Migrations completed successfully");
    process.exit(0);
  } catch (err: unknown) {
    console.error("Migrations failed", err);
    process.exit(1);
  }
};

runMigrations();
