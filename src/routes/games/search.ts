import { Elysia } from "elysia";
import { eq, like } from "drizzle-orm";

import { db, game } from "../../db";
import { getRedisClient } from "../../utils/redis/redisClient";
import { transformGameResponse } from "./utils";
import { searchIGDB } from "../igdb/utils";
import { enqueueGamesBatchWrite } from "../../utils/redis/sqliteWriter";
import { enqueueSimilarGames } from "../../utils/redis/similarGamesQueue";

// Constants
const SEARCH_LOCK_TTL = 10; // 10 seconds
const SEARCH_RESULTS_TTL = 86400; // 24 hours
const GAME_DATA_TTL = 604800; // 7 days

export const searchGames = new Elysia().get("/search", async ({ query }) => {
  const searchQuery = query?.q as string;
  const limit = query?.limit ? parseInt(query.limit) : 50;

  if (!searchQuery || searchQuery.trim().length === 0) {
    return {
      results: [],
      meta: {
        total: 0,
        source: "none",
        error: "Search query is required",
      },
    };
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const redis = getRedisClient();
  const searchId = `search:${normalizedQuery}:${Math.floor(Date.now() / 1000)}`;
  const searchLockKey = `search_processing:${normalizedQuery}`;
  const searchCacheKey = `search:${normalizedQuery}`;

  // Check if there's an active search for this query
  const lockExists = await redis.get(searchLockKey);

  if (lockExists) {
    // This is a duplicate request, subscribe to results
    console.log(
      `Duplicate search for "${normalizedQuery}", waiting for results`
    );

    // Check if results are already in cache
    const cachedResults = await redis.get(searchCacheKey);
    if (cachedResults) {
      const parsedResults = JSON.parse(cachedResults);
      return {
        results: parsedResults.results,
        meta: {
          total: parsedResults.results.length,
          source: "cache",
          freshness: "fresh",
          query_time_ms: 0,
          deduplicated: true,
        },
      };
    }

    // Wait a short time and check again (simplified approach)
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const resultsAfterWait = await redis.get(searchCacheKey);

    if (resultsAfterWait) {
      const parsedResults = JSON.parse(resultsAfterWait);
      return {
        results: parsedResults.results,
        meta: {
          total: parsedResults.results.length,
          source: "cache",
          freshness: "fresh",
          query_time_ms: 1000,
          deduplicated: true,
        },
      };
    }

    // If still no results, proceed with a new search
  }

  // Create a lock for this search
  await redis.set(searchLockKey, "1", "EX", SEARCH_LOCK_TTL);

  try {
    // Check if we have cached results
    const cachedResults = await redis.get(searchCacheKey);
    if (cachedResults) {
      const parsedResults = JSON.parse(cachedResults);
      return {
        results: parsedResults.results,
        meta: {
          total: parsedResults.results.length,
          source: "cache",
          freshness: "fresh",
          query_time_ms: 0,
        },
      };
    }

    // Check SQLite for results
    console.log(`Searching SQLite for "${normalizedQuery}"`);
    const startTime = Date.now();

    const dbGames = await db.query.game.findMany({
      where: like(game.name, `%${normalizedQuery}%`),
      orderBy: (games, { desc }) => [
        desc(games.isPopular),
        desc(games.totalRating),
      ],
      limit,
      with: {
        cover: true,
        screenshots: true,
        websites: true,
        platforms: {
          with: {
            platform: true,
          },
        },
        genres: {
          with: {
            genre: true,
          },
        },
        similarGames: {
          with: {
            similarGame: true,
          },
        },
      },
    });

    const queryTime = Date.now() - startTime;

    if (dbGames.length > 0) {
      const results = dbGames.map(transformGameResponse);

      // Cache the results
      await redis.set(
        searchCacheKey,
        JSON.stringify({ results, timestamp: Date.now() }),
        "EX",
        SEARCH_RESULTS_TTL
      );

      // Extract game IDs from results
      const gameIds = results
        .map((game) => game.id)
        .filter((id): id is number => id !== undefined);

      // Enqueue similar games for background processing
      // This won't block the response
      enqueueSimilarGames(gameIds).catch((error) => {
        console.error("Error enqueueing similar games:", error);
      });

      return {
        results,
        meta: {
          total: results.length,
          source: "database",
          freshness: "fresh",
          query_time_ms: queryTime,
        },
      };
    }

    // If not found in SQLite, query IGDB
    console.log(`Searching IGDB for "${normalizedQuery}"`);
    const igdbStartTime = Date.now();
    const igdbResults = await searchIGDB(normalizedQuery, true, limit);
    const igdbQueryTime = Date.now() - igdbStartTime;

    if (igdbResults.length > 0) {
      // Cache the results
      await redis.set(
        searchCacheKey,
        JSON.stringify({ results: igdbResults, timestamp: Date.now() }),
        "EX",
        SEARCH_RESULTS_TTL
      );

      // Enqueue write operations to SQLite using our queue system
      await enqueueGamesBatchWrite(igdbResults, searchId);
      console.log(`Enqueued ${igdbResults.length} games for writing to SQLite`);

      // Extract game IDs from results
      const igdbGameIds = igdbResults
        .map((game) => game.id)
        .filter((id): id is number => id !== undefined);

      // Enqueue similar games for background processing
      // This won't block the response
      enqueueSimilarGames(igdbGameIds).catch((error) => {
        console.error("Error enqueueing similar games:", error);
      });

      return {
        results: igdbResults,
        meta: {
          total: igdbResults.length,
          source: "igdb",
          freshness: "fresh",
          query_time_ms: igdbQueryTime,
        },
      };
    }

    return {
      results: [],
      meta: {
        total: 0,
        source: "all",
        query_time_ms: Date.now() - startTime,
      },
    };
  } finally {
    // Release the lock
    await redis.del(searchLockKey);
  }
});
