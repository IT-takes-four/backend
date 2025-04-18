import { cors } from "@elysiajs/cors";

import { createLogger } from "./enhancedLogger";
import { getConfig } from "@/config";

const logger = createLogger("cors");
const { isDev, trustedOrigins } = getConfig();

export const getCors = () => {
  if (isDev) {
    logger.system("🔓 CORS disabled for development");

    return cors({
      origin: true,
      credentials: true,
    });
  }

  logger.system(`🔐 CORS in PROD: ${trustedOrigins}`);

  return cors({
    origin: (request) => {
      const origin = request.headers.get("origin");
      if (!origin) return false;
      return trustedOrigins.includes(origin);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });
};
