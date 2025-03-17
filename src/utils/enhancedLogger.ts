import winston from "winston";
import { format } from "winston";
import * as Sentry from "@sentry/bun";
import "winston-daily-rotate-file";

const { combine, timestamp, printf, colorize, json } = format;

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  TRACE = "silly",
  SYSTEM = "system",
}

let sentryEnabled = false;

export const initSentry = (): boolean => {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    winstonLogger.info("[Sentry] DSN not provided, error tracking is disabled");
    sentryEnabled = false;
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    });

    sentryEnabled = true;
    winstonLogger.info("[Sentry] Initialized successfully");

    setupGlobalErrorHandlers();

    return true;
  } catch (error) {
    winstonLogger.error("[Sentry] Failed to initialize:", error);
    sentryEnabled = false;
    return false;
  }
};

export const isSentryEnabled = (): boolean => {
  return sentryEnabled;
};

export const flushSentry = async (): Promise<boolean> => {
  if (!sentryEnabled) {
    return true;
  }

  try {
    const result = await Sentry.close(2000);
    return result;
  } catch (error) {
    winstonLogger.error("[Sentry] Error flushing events:", error);
    return false;
  }
};

const consoleFormat = combine(
  colorize(),
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  printf(({ timestamp, level, message, service, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? JSON.stringify(meta, null, 2)
      : "";
    return `[${timestamp}] [${level}] [${
      service || "app"
    }] ${message} ${metaString}`;
  })
);

const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), json()),
  defaultMeta: { service: "quokka-api" },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.DailyRotateFile({
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      dirname: process.env.LOG_DIR || "./logs",
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      filename: "combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      dirname: process.env.LOG_DIR || "./logs",
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),
    new winston.transports.DailyRotateFile({
      filename: "info-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "info",
      dirname: process.env.LOG_DIR || "./logs",
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),
  ],
});

const setupGlobalErrorHandlers = () => {
  process.on("uncaughtException", (error) => {
    winstonLogger.error("Uncaught exception:", { error });
    Sentry.captureException(error);
  });

  process.on("unhandledRejection", (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    winstonLogger.error("Unhandled rejection:", { error });
    Sentry.captureException(error);
  });
};

export interface EnhancedLogger {
  error: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  info: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
  trace: (message: string, meta?: Record<string, any>) => void;
  system: (message: string, meta?: Record<string, any>) => void;
  exception: (error: unknown, meta?: Record<string, any>) => void;
  setLevel: (level: LogLevel) => void;
  level: string;
}

export const createLogger = (namespace: string): EnhancedLogger => {
  return {
    error: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.error(message, { namespace, ...meta });

      if (sentryEnabled) {
        Sentry.captureMessage(message, {
          level: "error",
          tags: { namespace },
          extra: meta,
        });
      }
    },

    warn: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.warn(message, { namespace, ...meta });

      if (sentryEnabled) {
        Sentry.captureMessage(message, {
          level: "warning",
          tags: { namespace },
          extra: meta,
        });
      }
    },

    info: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.info(message, { namespace, ...meta });

      if (sentryEnabled && meta && meta.sendToSentry) {
        Sentry.captureMessage(message, {
          level: "info",
          tags: { namespace },
          extra: meta,
        });
      }
    },

    debug: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.debug(message, { namespace, ...meta });
    },

    trace: (message: string, meta: Record<string, any> = {}) => {
      winstonLogger.silly(message, { namespace, ...meta });
    },

    system: (message: string, meta: Record<string, any> = {}) => {
      const originalLevel = winstonLogger.level;
      winstonLogger.level = "info";

      winstonLogger.info(message, {
        namespace,
        messageType: "SYSTEM",
        ...meta,
      });

      winstonLogger.level = originalLevel;
    },

    exception: (error: unknown, meta: Record<string, any> = {}) => {
      const errorObject =
        error instanceof Error ? error : new Error(String(error));

      winstonLogger.error(errorObject.message, {
        namespace,
        error: {
          name: errorObject.name,
          message: errorObject.message,
          stack: errorObject.stack,
        },
        ...meta,
      });

      if (sentryEnabled) {
        Sentry.captureException(errorObject, {
          tags: { namespace },
          extra: meta,
        });
      }
    },

    setLevel: (level: LogLevel) => {
      winstonLogger.level = level;
    },

    get level() {
      return winstonLogger.level;
    },

    set level(level: string) {
      winstonLogger.level = level;
    },
  };
};

const defaultLogger = createLogger("app");
export default defaultLogger;
