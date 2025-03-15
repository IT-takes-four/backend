import axios from "axios";

import { getRedisClient } from "../redis/redisClient";

// Twitch tokens are valid for 60 days, but we refresh more frequently as a precaution
const TOKEN_TTL = 24 * 60 * 60; // 24 hours
const TOKEN_CACHE_KEY = "igdb:access_token";

export const getIGDBToken = async (): Promise<string> => {
  const redis = getRedisClient();

  const cachedToken = await redis.get(TOKEN_CACHE_KEY);
  if (cachedToken) {
    return cachedToken;
  }

  const token = await requestNewToken();
  await redis.setex(TOKEN_CACHE_KEY, TOKEN_TTL, token);

  return token;
};

const requestNewToken = async (): Promise<string> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Twitch API credentials");
  }

  try {
    const tokenUrl = "https://id.twitch.tv/oauth2/token";
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return `Bearer ${response.data.access_token}`;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to get IGDB access token:", errorMessage);
    throw new Error("Failed to get IGDB access token");
  }
};
