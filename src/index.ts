import { Context, Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";

import { routes } from "@/routes";
import { startWorkerInBackground } from "@/utils/redis/sqliteWriter";
import { startSimilarGamesWorker } from "@/utils/redis/similarGamesQueue";
import logger, {
  LogLevel,
  initSentry,
  isSentryEnabled,
  flushSentry,
} from "@/utils/enhancedLogger";
import { auth } from "./lib/auth";
// import { mergeSwaggerSchemas } from "@/utils/swaggerMerger";
import { getCors } from "@/utils/getCors";
import { getSchemas } from "@/utils/getSchemas";
import { getConfig } from "@/config";

const { redisUrl, sqliteUrl, postgresUrl } = getConfig();

const validateEnvironment = () => {
  const missingVars = [];

  if (!redisUrl) {
    missingVars.push("REDIS_URL");
  }

  if (!sqliteUrl && !postgresUrl) {
    missingVars.push("SQLITE_DATABASE_URL or POSTGRES_URL");
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
logger.system(`Starting playdamnit API with log level: ${logLevel}`);

validateEnvironment();

const sentryEnabled = initSentry();
if (sentryEnabled) {
  logger.system("Sentry error tracking enabled");
} else {
  logger.system("Sentry error tracking disabled");
}

startWorkerInBackground();

const betterAuthView = (context: Context) => {
  const BETTER_AUTH_ACCEPT_METHODS = ["POST", "GET"];
  if (BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
    return auth.handler(context.request);
  } else {
    context.error(405);
  }
};

const setupApp = async () => {
  // const mergedDocumentation = await mergeSwaggerSchemas();

  const app = new Elysia({ name: "playdamnit-api" })
    .use(getCors())
    // .use(
    //   swagger({
    //     documentation: mergedDocumentation,
    //   })
    // )
    .use(
      swagger({
        path: "/swagger",
        documentation: {
          info: {
            title: "Your API",
            version: "1.0.0",
          },
          components: {
            schemas: getSchemas(),
          },
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
          message:
            error instanceof Error ? error.message : "Resource not found",
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

    .group("/api", (app) => app.all("/auth/*", betterAuthView).use(routes));

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

  return app;
};

setupApp().catch((error) => {
  logger.exception(error, { source: "app-setup" });
  process.exit(1);
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
