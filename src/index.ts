import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";

import { gamesRouter } from "@/routes/games";
import { igdbRouter } from "@/routes/igdb";
import { webhooksRouter } from "@/routes/webhooks";

import { startWorkerInBackground } from "@/utils/redis/sqliteWriter";
import { startSimilarGamesWorker } from "@/utils/redis/similarGamesQueue";
import logger, {
  LogLevel,
  initSentry,
  isSentryEnabled,
  flushSentry,
} from "@/utils/enhancedLogger";

const validateEnvironment = () => {
  const missingVars = [];

  if (!process.env.REDIS_URL) {
    missingVars.push("REDIS_URL");
  }

  if (!process.env.SQLITE_DATABASE_URL && !process.env.DATABASE_URL) {
    missingVars.push("SQLITE_DATABASE_URL or DATABASE_URL");
  }

  if (missingVars.length > 0) {
    logger.error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
    logger.system(
      "Application startup aborted: Configure the missing environment variables and restart"
    );
    process.exit(1);
  }

  return true;
};

const logLevel = (process.env.LOG_LEVEL || "info") as LogLevel;

logger.level = logLevel;
logger.info(`Starting Quokka API with log level: ${logLevel}`);

validateEnvironment();

const sentryEnabled = initSentry();
if (sentryEnabled) {
  logger.system("Sentry error tracking enabled");
} else {
  logger.system("Sentry error tracking disabled");
}

startWorkerInBackground();

const app = new Elysia({ name: "quokka-api" })
  .use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  )
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
          { name: "webhooks", description: "Webhook endpoints" },
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
  .onError(({ code, error, set, path }) => {
    logger.exception(error, { code });

    if (code === "NOT_FOUND") {
      if (path === "/favicon.ico") {
        set.status = 204;
        return null;
      }

      set.status = 404;
      return {
        error: "Not Found",
        message: error instanceof Error ? error.message : "Resource not found",
      };
    }

    if (code === 401) {
      set.status = 401;
      return {
        error: "Unauthorized",
        message:
          error instanceof Error ? error.message : "Authentication required",
      };
    }

    set.status = 500;
    return {
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    };
  })
  .group("/api", (app) =>
    app
      .get("/", () => "Quokka API is running!")
      .use(gamesRouter)
      .use(igdbRouter)
      .use(webhooksRouter)
  );

const PORT = process.env.PORT || 3030;

app.listen(PORT, () => {
  logger.system(
    `🚀 Server is running at ${app.server?.hostname}:${app.server?.port}`
  );
  logger.system(
    `📚 Swagger documentation available at ${app.server?.hostname}:${app.server?.port}/swagger`
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
