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
import logger, {
  LogLevel,
  initSentry,
  isSentryEnabled,
  flushSentry,
} from "./utils/enhancedLogger";

const logLevel = (process.env.LOG_LEVEL || "info") as LogLevel;

logger.level = logLevel;
logger.info(`Starting Quokka API with log level: ${logLevel}`);

const sentryEnabled = initSentry();
if (sentryEnabled) {
  logger.system("Sentry error tracking enabled");
} else {
  logger.system("Sentry error tracking disabled");
}

startWorkerInBackground();

const app = new Elysia({ name: "quokka-api" })
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
  .onError(({ code, error, set }) => {
    logger.exception(error, { code });

    if (code === "NOT_FOUND") {
      set.status = 404;
      return {
        error: "Not Found",
        message: error instanceof Error ? error.message : "Resource not found",
      };
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    };
  })
  .use(gamesRouter)
  .use(igdbRouter)
  .get("/", () => "Quokka API is running!")
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
  });

app.listen(3000, () => {
  logger.system(
    `🦘 Quokka API is running at ${app.server?.hostname}:${app.server?.port}`
  );

  startSimilarGamesWorker(60000, 25)
    .then((workerId) => {
      logger.system(`Similar games worker started with ID: ${workerId}`);
    })
    .catch((error) => {
      logger.exception(error, { source: "similar-games-worker" });
    });
});

const shutdown = async () => {
  logger.system("Application shutting down...");

  if (isSentryEnabled()) {
    await flushSentry();
  }

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
