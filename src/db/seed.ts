import {
  db,
  platform,
  genre,
  gameMode,
  type as gameType,
  websiteType,
} from ".";
import { platforms, genres, gameModes, types, websiteTypes } from "./seed-data";

const seed = async () => {
  try {
    console.log("Seeding database...");

    // Insert platforms
    console.log(`Inserting ${platforms.length} platforms...`);
    await db.insert(platform).values(platforms);
    console.log("Platforms seeded");

    // Insert genres
    console.log(`Inserting ${genres.length} genres...`);
    await db.insert(genre).values(genres);
    console.log("Genres seeded");

    // Insert game modes
    console.log(`Inserting ${gameModes.length} game modes...`);
    await db.insert(gameMode).values(gameModes);
    console.log("Game modes seeded");

    // Insert types
    console.log(`Inserting ${types.length} game types...`);
    await db.insert(gameType).values(types);
    console.log("Types seeded");

    // Insert website types
    console.log(`Inserting ${websiteTypes.length} website types...`);
    await db.insert(websiteType).values(websiteTypes);
    console.log("Website types seeded");

    console.log("Database seeded successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seed();
