import { eq, inArray } from "drizzle-orm";

import { getRedisClient } from "./redisClient";
import { RedisQueue } from "./redisQueue";
import { IGDBGameResponse } from "../../routes/igdb/types";
import { db } from "../../db";
import { game, gameToSimilarGame } from "../../db/schema";
import { enqueueGameWrite } from "./sqliteWriter";
import { fetchIGDBByIds } from "../../routes/igdb/utils";
import { createLogger } from "../enhancedLogger";
import { getCurrentTimestamp } from "../time";

const SIMILAR_GAMES_QUEUE = "similar_games";
const SIMILAR_GAMES_PENDING = "similar_games:pending";
const SIMILAR_GAMES_PROCESSED = "similar_games:processed";
const SIMILAR_GAMES_RELATIONSHIPS = "similar_games:relationships"; // Redis hash storing game -> similar games
const SYSTEM_BUSY_THRESHOLD = 10;

const logger = createLogger("similar-games-queue");

// Create a queue for similar games processing
const similarGamesQueue = new RedisQueue(SIMILAR_GAMES_QUEUE);

export const storeSimilarGameRelationship = async (
  gameId: number,
  similarGameIds: number[]
): Promise<void> => {
  if (!gameId || !similarGameIds || similarGameIds.length === 0) return;

  const redis = getRedisClient();

  // Filter out invalid IDs and the game itself
  const validIds = similarGameIds
    .filter((id) => id && !isNaN(id) && id > 0 && id !== gameId)
    .map((id) => id.toString());

  if (validIds.length === 0) return;

  // Store the relationship in Redis
  await redis.hset(
    SIMILAR_GAMES_RELATIONSHIPS,
    gameId.toString(),
    JSON.stringify(validIds)
  );

  // Queue the game for relationship processing
  await redis.sadd(SIMILAR_GAMES_PENDING, gameId.toString());

  logger.info(
    `Stored ${validIds.length} similar game relationships for game ${gameId}`
  );

  // We don't immediately try to fetch similar games
  // The background worker will handle this when processing the game
};

export const enqueueSimilarGames = async (gameIds: number[]): Promise<void> => {
  if (!gameIds || gameIds.length === 0) return;

  // Filter out invalid IDs
  const validIds = gameIds
    .filter((id) => id && !isNaN(id) && id > 0)
    .map((id) => id.toString());

  if (validIds.length === 0) return;

  // Check which games already exist in the database
  const numericIds = validIds.map((id) => parseInt(id));
  const existingGames = await db.query.game.findMany({
    where: (fields, { inArray }) => inArray(fields.id, numericIds),
    columns: { id: true },
  });

  const existingIds = new Set(existingGames.map((g) => g.id.toString()));

  // Filter out games that already exist
  const missingIds = validIds.filter((id) => !existingIds.has(id));

  if (missingIds.length === 0) return;

  logger.info(`Fetching ${missingIds.length} missing games from IGDB`);

  // Fetch missing games in batches
  const BATCH_SIZE = 25;
  for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
    const batch = missingIds.slice(i, i + BATCH_SIZE);
    const numericBatch = batch.map((id) => parseInt(id));

    try {
      // Fetch the batch from IGDB using the new function
      logger.info(`Fetching batch of games with IDs: ${batch.join(",")}`);
      const results = await fetchIGDBByIds(numericBatch, false); // Don't filter by game type to get all similar games

      if (results.length === 0) {
        logger.info(`No games found for IDs: ${batch.join(",")}`);
        continue;
      }

      logger.info(`Found ${results.length} games, queueing for writing`);

      // Queue each game for writing to SQLite
      for (const gameData of results) {
        await enqueueGameWrite(gameData as IGDBGameResponse);

        // Store similar game relationships if they exist
        if (gameData.similar_games && gameData.similar_games.length > 0) {
          await storeSimilarGameRelationship(
            gameData.id,
            gameData.similar_games
          );
        }
      }

      // If we're not at the last batch, wait a bit to avoid rate limiting
      if (i + BATCH_SIZE < missingIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.exception(error, {
        context: "Similar games queue",
        operation: "fetchIGDBByIds",
        batch: batch.join(","),
      });
    }
  }
};

export const processSimilarGamesBatch = async (
  batchSize: number = 5
): Promise<void> => {
  // Check if system is busy with higher priority tasks
  const sqliteWriteQueue = new RedisQueue("sqlite_write");
  const mainQueueSize =
    (await sqliteWriteQueue.getQueueLength()) +
    (await sqliteWriteQueue.getProcessingLength());

  if (mainQueueSize > SYSTEM_BUSY_THRESHOLD) {
    logger.info(
      `System busy with ${mainQueueSize} main tasks, skipping similar games processing`
    );
    return;
  }

  const redis = getRedisClient();

  // Get a batch of game IDs from the pending set
  const gameIds = await redis.spop(SIMILAR_GAMES_PENDING, batchSize);

  if (!gameIds || gameIds.length === 0) return;

  logger.info(`Processing batch of ${gameIds.length} games`);

  // Process each game
  for (const gameId of gameIds) {
    try {
      const success = await processSimilarGame(parseInt(gameId));

      // Mark as processed if successful
      if (success) {
        await redis.sadd(SIMILAR_GAMES_PROCESSED, gameId);
      } else {
        // Put back in pending set if not successful
        await redis.sadd(SIMILAR_GAMES_PENDING, gameId);
      }
    } catch (error) {
      logger.exception(error, {
        context: "Similar games queue",
        operation: "processSimilarGame",
        gameId,
      });
      // Put back in pending set if failed
      await redis.sadd(SIMILAR_GAMES_PENDING, gameId);
    }
  }
};

async function processSimilarGame(gameId: number): Promise<boolean> {
  if (!gameId || isNaN(gameId) || gameId <= 0) {
    logger.error(`Invalid game ID: ${gameId}`);
    return false;
  }

  logger.info(`Processing similar games for game ID: ${gameId}`);

  try {
    const redis = getRedisClient();

    // Step 1: Check if the game exists in our database
    const existingGame = await db.query.game.findFirst({
      where: eq(game.id, gameId),
      columns: { id: true },
    });

    if (!existingGame) {
      logger.info(`Game ${gameId} not found in database, skipping`);
      return false; // Try again later
    }

    // Step 2: Get the similar game IDs from Redis
    const similarGamesJson = await redis.hget(
      SIMILAR_GAMES_RELATIONSHIPS,
      gameId.toString()
    );

    if (!similarGamesJson) {
      logger.info(`No similar games found for game ${gameId}`);

      // If we don't have similar games info, fetch it from IGDB
      const results = await fetchIGDBByIds([gameId], false);

      if (
        results.length === 0 ||
        !results[0].similar_games ||
        results[0].similar_games.length === 0
      ) {
        logger.info(`No similar games found in IGDB for game ${gameId}`);
        return true; // Mark as processed
      }

      // Store the similar game relationships
      await storeSimilarGameRelationship(gameId, results[0].similar_games);
      return false; // Process again later
    }

    // Parse the similar game IDs
    const similarGameIds = JSON.parse(similarGamesJson) as string[];

    if (similarGameIds.length === 0) {
      logger.info(`Empty similar games list for game ${gameId}`);
      return true; // Mark as processed
    }

    // Step 3: Check which similar games exist in our database
    const numericIds = similarGameIds.map((id) => parseInt(id));
    const existingGames = await db.query.game.findMany({
      where: (fields, { inArray }) => inArray(fields.id, numericIds),
      columns: { id: true },
    });

    const existingIds = existingGames.map((g) => g.id);

    if (existingIds.length === 0) {
      logger.info(`No similar games exist in database yet for game ${gameId}`);

      // Queue the missing games for fetching
      await enqueueSimilarGames(numericIds);

      return false; // Try again later
    }

    // If some games are missing, queue them for fetching
    if (existingIds.length < numericIds.length) {
      const existingIdSet = new Set(existingIds);
      const missingIds = numericIds.filter((id) => !existingIdSet.has(id));

      logger.info(
        `Queueing ${missingIds.length} missing similar games for fetching`
      );

      await enqueueSimilarGames(missingIds);
    }

    // Step 4: Check which relationships already exist
    const existingRelations = await db.query.gameToSimilarGame.findMany({
      where: eq(gameToSimilarGame.gameId, gameId),
      columns: { similarGameId: true },
    });

    const existingRelationIds = new Set(
      existingRelations.map((rel) => rel.similarGameId)
    );

    // Filter out games that already have relationships
    const newRelationIds = existingIds.filter(
      (id) => !existingRelationIds.has(id)
    );

    if (newRelationIds.length === 0) {
      logger.info(
        `All existing similar games already have relationships for game ${gameId}`
      );

      // If we've created all possible relationships, check if we need to try again later
      if (existingIds.length < similarGameIds.length) {
        const existingIdSet = new Set(existingIds);
        const stillMissingIds = numericIds.filter(
          (id) => !existingIdSet.has(id)
        );

        logger.info(`Similar games still missing for game ${gameId}`);

        // Try to fetch the missing games again
        await enqueueSimilarGames(stillMissingIds);

        return false; // Try again later
      }

      return true; // Mark as processed
    }

    // Step 5: Create new relationships
    logger.info(
      `Creating ${newRelationIds.length} new relationships for game ${gameId}`
    );

    try {
      await db.transaction(async (tx) => {
        for (const similarGameId of newRelationIds) {
          // Create forward relationship
          await tx
            .insert(gameToSimilarGame)
            .values({
              gameId,
              similarGameId,
              createdAt: getCurrentTimestamp(),
            })
            .onConflictDoNothing();

          // Create reverse relationship
          await tx
            .insert(gameToSimilarGame)
            .values({
              gameId: similarGameId,
              similarGameId: gameId,
              createdAt: getCurrentTimestamp(),
            })
            .onConflictDoNothing();
        }
      });

      logger.info(
        `Created ${
          newRelationIds.length * 2
        } bidirectional relationships for game ${gameId}`
      );
    } catch (error) {
      logger.exception(error, {
        error: String(error),
        gameId,
        operation: "createRelationships",
      });
      return false; // Try again later
    }

    // If we've created all possible relationships, check if we need to try again later
    if (existingIds.length < similarGameIds.length) {
      const existingIdSet = new Set(existingIds);
      const stillMissingIds = numericIds.filter((id) => !existingIdSet.has(id));

      logger.info(`Similar games still missing for game ${gameId}`);

      // Try to fetch the missing games again
      await enqueueSimilarGames(stillMissingIds);

      return false; // Try again later
    }

    return true; // Mark as processed
  } catch (error) {
    logger.exception(error, {
      context: "Similar games queue",
      operation: "processSimilarGame:internal",
      gameId: gameId.toString(),
    });
    return false; // Try again later
  }
}

/**
 * Start the background worker for processing similar games
 */
export const startSimilarGamesWorker = async (
  intervalMs: number = 60000,
  batchSize: number = 5
): Promise<NodeJS.Timer> => {
  logger.system(
    `Starting similar games worker (interval: ${intervalMs}ms, batch size: ${batchSize})`
  );

  // Initial run
  await processSimilarGamesBatch(batchSize);

  // Schedule recurring runs
  const intervalId = setInterval(async () => {
    try {
      await processSimilarGamesBatch(batchSize);
    } catch (error) {
      logger.exception(error, {
        context: "Similar games worker",
        operation: "processSimilarGamesBatch",
      });
    }
  }, intervalMs);

  return intervalId;
};

/**
 * Stop the background worker
 */
export const stopSimilarGamesWorker = (intervalId: NodeJS.Timer): void => {
  logger.system(`Stopping similar games worker`);
  clearInterval(intervalId);
};

/**
 * Get statistics about the similar games queue
 */
export const getSimilarGamesStats = async (): Promise<{
  pendingCount: number;
  processedCount: number;
  relationshipsCount: number;
  queueLength: number;
  processingLength: number;
}> => {
  const redis = getRedisClient();

  const [
    pendingCount,
    processedCount,
    relationshipsCount,
    queueLength,
    processingLength,
  ] = await Promise.all([
    redis.scard(SIMILAR_GAMES_PENDING),
    redis.scard(SIMILAR_GAMES_PROCESSED),
    redis.hlen(SIMILAR_GAMES_RELATIONSHIPS),
    similarGamesQueue.getQueueLength(),
    similarGamesQueue.getProcessingLength(),
  ]);

  return {
    pendingCount,
    processedCount,
    relationshipsCount,
    queueLength,
    processingLength,
  };
};
