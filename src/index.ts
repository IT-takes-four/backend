import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";
import { eq } from "drizzle-orm";

import {
  db,
  platform,
  genre,
  gameMode,
  type as gameType,
  websiteType,
} from "./db";
import { gamesRouter } from "./routes/games";
import { igdbRouter } from "./routes/igdb";
import { startWorkerInBackground } from "./utils/redis/sqliteWriter";
import { startSimilarGamesWorker } from "./utils/redis/similarGamesQueue";
import logger, { LogLevel } from "./utils/logger";

const logLevel = (process.env.LOG_LEVEL || "info") as LogLevel;
logger.level = logLevel;
logger.info(`Starting Quokka API with log level: ${logLevel}`);

startWorkerInBackground();

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "Quokka API",
          version: "1.0.0",
          description: "API for the Quokka game tracking application",
        },
        tags: [
          { name: "games", description: "Game related endpoints" },
          { name: "igdb", description: "IGDB integration endpoints" },
        ],
      },
    })
  )
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "supersecret",
    })
  )
  .get("/", () => "Quokka API is running!")
  .use(gamesRouter)
  .use(igdbRouter)

  // Platforms endpoints
  .get("/platforms", async () => {
    return await db.select().from(platform);
  })
  .get("/platforms/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(platform)
      .where(eq(platform.id, parseInt(id)))
      .limit(1);
  })

  // Genres endpoints
  .get("/genres", async () => {
    return await db.select().from(genre);
  })
  .get("/genres/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(genre)
      .where(eq(genre.id, parseInt(id)))
      .limit(1);
  })

  // Game modes endpoints
  .get("/game-modes", async () => {
    return await db.select().from(gameMode);
  })
  .get("/game-modes/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(gameMode)
      .where(eq(gameMode.id, parseInt(id)))
      .limit(1);
  })

  // Game types endpoints
  .get("/types", async () => {
    return await db.select().from(gameType);
  })
  .get("/types/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(gameType)
      .where(eq(gameType.id, parseInt(id)))
      .limit(1);
  })

  // Website types endpoints
  .get("/website-types", async () => {
    return await db.select().from(websiteType);
  })
  .get("/website-types/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(websiteType)
      .where(eq(websiteType.id, parseInt(id)))
      .limit(1);
  })

  .listen(3000, () => {
    console.log(`🦊 Elysia is running at http://localhost:3000`);
    logger.info(`🦊 Elysia is running at http://localhost:3000`);

    // Start the similar games background worker
    startSimilarGamesWorker(60000, 5)
      .then((workerId) => {
        console.log(`Similar games worker started with ID: ${workerId}`);
        logger.info(`Similar games worker started with ID: ${workerId}`);
      })
      .catch((error) => {
        console.error("Failed to start similar games worker:", error);
        logger.error("Failed to start similar games worker:", { error });
      });
  });
