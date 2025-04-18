import { Elysia, t } from "elysia";
import { like, sql } from "drizzle-orm";
import { z } from "zod";

import { db, game } from "@/db/sqlite";
import { getRedisClient } from "@/utils/redis/redisClient";
import { transformGameResponse } from "@/utils/gameTransformers";
import { searchIGDB } from "@/utils/igdb/utils";
import { enqueueGamesBatchWrite } from "@/utils/redis/sqliteWriter";
import { enqueueSimilarGames } from "@/utils/redis/similarGamesQueue";
import { createLogger } from "@/utils/enhancedLogger";
import { getCurrentTimestamp } from "@/utils/time";
import { GameResponseSchema } from "@/schemas/game";
import { InternalServerErrorResponseSchema } from "@/schemas/error";
import { BadRequestErrorResponseSchema } from "@/schemas/error";

const logger = createLogger("games-search");

const SEARCH_LOCK_TTL = 10; // 10 seconds
const SEARCH_RESULTS_TTL = 86400; // 24 hours
const GAME_DATA_TTL = 604800; // 7 days

async function fetchGamesFromDB(
  whereClause: any,
  limit: number,
  offset: number
) {
  return db.query.game.findMany({
    where: whereClause,
    orderBy: (games, { desc }) => [
      desc(games.isPopular),
      desc(games.totalRating),
    ],
    limit,
    offset,
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
      types: {
        with: {
          type: true,
        },
      },
      similarGames: {
        with: {
          similarGame: true,
        },
      },
    },
  });
}

// Helper function for the notInArray condition
function notInArray(column: any, values: number[]) {
  return values.length > 0
    ? sql`${column} NOT IN (${values.join(",")})`
    : sql`1=1`; // No-op condition when values array is empty
}

export const getGamesSearch = new Elysia().get(
  "/games/search",
  async ({ query }) => {
    const searchQuery = query?.q as string;
    const limit = query?.limit ? query.limit : 50;
    const offset = query?.offset ? query.limit : 0;
    const forceFresh = query?.fresh === "true" || query?.fresh === "1";

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
    const searchId = `search:${normalizedQuery}:${getCurrentTimestamp()}`;
    const searchLockKey = `search_processing:${normalizedQuery}:${limit}:${offset}`;
    const searchCacheKey = `search:${normalizedQuery}:${limit}:${offset}`;

    // Check if there's an active search for this query
    const lockExists = await redis.get(searchLockKey);

    if (lockExists && !forceFresh) {
      logger.info(
        `Duplicate search for "${normalizedQuery}", waiting for results`
      );

      const cacheStartTime = Date.now();
      const cachedResults = await redis.get(searchCacheKey);
      if (cachedResults) {
        const parsedResults = JSON.parse(cachedResults);
        return {
          results: parsedResults.results,
          meta: {
            total: parsedResults.results.length,
            source: "cache",
            freshness: "fresh",
            query_time_ms: Date.now() - cacheStartTime,
            deduplicated: true,
          },
        };
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      const waitStartTime = Date.now();
      const resultsAfterWait = await redis.get(searchCacheKey);

      if (resultsAfterWait) {
        const parsedResults = JSON.parse(resultsAfterWait);
        return {
          results: parsedResults.results,
          meta: {
            total: parsedResults.results.length,
            source: "cache",
            freshness: "fresh",
            query_time_ms: Date.now() - waitStartTime + 1000,
            deduplicated: true,
          },
        };
      }
    }

    await redis.set(searchLockKey, "1", "EX", SEARCH_LOCK_TTL);

    try {
      if (!forceFresh) {
        const cacheCheckStartTime = Date.now();
        const cachedResults = await redis.get(searchCacheKey);
        if (cachedResults) {
          const parsedResults = JSON.parse(cachedResults);
          return {
            results: parsedResults.results,
            meta: {
              total: parsedResults.results.length,
              source: "cache",
              freshness: "fresh",
              query_time_ms: Date.now() - cacheCheckStartTime,
            },
          };
        }
      } else {
        logger.info(
          `Fresh results requested for "${normalizedQuery}", bypassing cache`
        );
      }

      logger.info(`Searching SQLite for "${normalizedQuery}"`);
      const startTime = Date.now();

      // Create a version of the query with special characters removed for more inclusive matching
      const cleanedQuery = searchQuery.trim().replace(/[^\w\s]/gi, "");
      const exactQuery = searchQuery.trim();

      // First try to find exact matches (case insensitive)
      let dbGames = await fetchGamesFromDB(
        like(game.name, `%${exactQuery}%`),
        limit,
        offset ?? 0
      );

      // If we don't have enough results and the cleaned query is different,
      // supplement with results using the cleaned query
      if (dbGames.length < limit && cleanedQuery !== exactQuery) {
        const remainingLimit = limit - dbGames.length;
        const remainingOffset = Math.max(0, (offset ?? 0) - dbGames.length);

        // Get the IDs of already found games to exclude them
        const existingIds = dbGames.map((game) => game.id);

        const whereClause = sql`${like(
          game.name,
          `%${cleanedQuery}%`
        )} AND ${notInArray(game.id, existingIds)}`;

        const additionalGames = await fetchGamesFromDB(
          whereClause,
          remainingLimit,
          remainingOffset
        );

        // Combine the results
        dbGames = [...dbGames, ...additionalGames];
      }

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
          logger.exception(error, {
            context: "Games search",
            operation: "enqueueSimilarGames",
            gameIds: gameIds.join(","),
          });
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
      logger.info(`Searching IGDB for "${normalizedQuery}"`);
      const igdbStartTime = Date.now();

      // For IGDB, try first with the original query
      let igdbResults = await searchIGDB(searchQuery.trim(), true, limit);

      // If no results and the query has special characters, try with cleaned version
      if (igdbResults.length === 0 && cleanedQuery !== searchQuery.trim()) {
        logger.info(
          `No results found, trying cleaned query: "${cleanedQuery}"`
        );
        igdbResults = await searchIGDB(cleanedQuery, true, limit);
      }

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
        logger.info(
          `Enqueued ${igdbResults.length} games for writing to SQLite`
        );

        const igdbGameIds = igdbResults
          .map((game) => game.id)
          .filter((id): id is number => id !== undefined);

        // Enqueue similar games for background processing
        // This won't block the response
        enqueueSimilarGames(igdbGameIds).catch((error) => {
          logger.exception(error, {
            context: "Games search",
            operation: "enqueueSimilarGames",
            gameIds: igdbGameIds.join(","),
          });
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
  },
  {
    query: t.Object({
      q: t.String(),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
      fresh: t.Optional(t.String()),
    }),
    detail: {
      tags: ["Games"],
      summary: "Search games by name",
      description:
        "Performs full-text search against local DB and IGDB fallback. Uses caching and queues.",
      responses: {
        200: {
          description: "List of matched games",
          content: {
            "application/json": {
              schema: z.toJSONSchema(z.array(GameResponseSchema)) as any,
            },
          },
        },
        400: {
          description: "Missing or invalid query",
          content: {
            "application/json": {
              schema: BadRequestErrorResponseSchema,
            },
          },
        },
        500: {
          description: "Server error",
          content: {
            "application/json": {
              schema: InternalServerErrorResponseSchema,
            },
          },
        },
      },
    },
  }
);
