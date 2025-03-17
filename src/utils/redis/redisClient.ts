import { Redis } from "ioredis";

import { createLogger } from "../enhancedLogger";

const logger = createLogger("redis-client");

const redisPassword = process.env.REDIS_PASSWORD || "";
const redisUrl = process.env.REDIS_URL || "localhost:6379";
const url = new URL(
  redisUrl.startsWith("redis://") ? redisUrl : `redis://${redisUrl}`
);
const redisHost = url.hostname;
const redisPort = parseInt(url.port || "6379");

const createRedisClient = () => {
  const client = new Redis({
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  client.on("error", (err: Error) => {
    logger.exception(err, {
      context: "Redis client",
      operation: "connection",
      host: redisHost,
      port: redisPort,
    });
  });

  client.on("connect", () => {
    logger.system("Redis client Connected");
  });

  return client;
};

let redisClient: Redis | null = null;

export const getRedisClient = () => {
  if (!redisClient) {
    try {
      redisClient = createRedisClient();
    } catch (error) {
      logger.exception(error, {
        context: "Redis client",
        operation: "createClient",
        host: redisHost,
        port: redisPort,
      });
      throw error; // Re-throw to let the application handle it
    }
  }
  return redisClient;
};
