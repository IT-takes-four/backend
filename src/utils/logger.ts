import winston from "winston";
import { format } from "winston";
const { combine, timestamp, printf, colorize, json } = format;

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
  TRACE = "silly",
}

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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp(), json()),
  defaultMeta: { service: "quokka-api" },
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      dirname: process.env.LOG_DIR || ".",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      dirname: process.env.LOG_DIR || ".",
    }),
  ],
});

export const createLogger = (namespace: string) => {
  return {
    error: (message: string, meta: object = {}) => {
      logger.error(message, { namespace, ...meta });
    },
    warn: (message: string, meta: object = {}) => {
      logger.warn(message, { namespace, ...meta });
    },
    info: (message: string, meta: object = {}) => {
      logger.info(message, { namespace, ...meta });
    },
    debug: (message: string, meta: object = {}) => {
      logger.debug(message, { namespace, ...meta });
    },
    trace: (message: string, meta: object = {}) => {
      logger.silly(message, { namespace, ...meta });
    },
    setLevel: (level: LogLevel) => {
      logger.level = level;
    },
  };
};

export default logger;
