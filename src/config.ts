const isDev = process.env.NODE_ENV === "development";

const postgresUrl = process.env.POSTGRES_URL;

const trustedOrigins =
  process.env.TRUSTED_ORIGINS?.split(",").map((s) => s.trim()) ?? [];

const redisUrl = process.env.REDIS_URL;

const sqliteUrl = process.env.SQLITE_DATABASE_URL;

const openaiApiKey = process.env.OPENAI_API_KEY;

const config = {
  isDev,
  trustedOrigins,
  postgresUrl,
  redisUrl,
  sqliteUrl,
  openaiApiKey,
};

export const getConfig = () => {
  return config;
};
