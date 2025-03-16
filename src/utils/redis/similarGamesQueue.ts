import { getRedisClient } from "./redisClient";
import { RedisQueue } from "./redisQueue";
import { searchIGDB } from "../../routes/igdb/getAll";
import { IGDBGameResponse } from "../../routes/igdb/types";
import { db } from "../../db";
import {
  game,
  gameToPlatform,
  gameToGenre,
  gameToGameMode,
  gameToSimilarGame,
  cover,
  screenshot,
  website,
} from "../../db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { enqueueGameWrite } from "./sqliteWriter";

// Constants
const SIMILAR_GAMES_QUEUE = "similar_games";
const SIMILAR_GAMES_SET = "similar_games:pending";
const SIMILAR_GAMES_PROCESSED = "similar_games:processed";
const SYSTEM_BUSY_THRESHOLD = 10; // If more than 10 items in the main queue, consider system busy

// Create a queue with lower priority
const similarGamesQueue = new RedisQueue(SIMILAR_GAMES_QUEUE);

/**
 * Add game IDs to the similar games pending set
 * @param gameIds Array of game IDs to fetch similar games for
 */
export const enqueueSimilarGames = async (gameIds: number[]): Promise<void> => {
  if (!gameIds || gameIds.length === 0) return;

  const redis = getRedisClient();
  const uniqueIds = [...new Set(gameIds)]; // Remove duplicates

  console.log(
    `[SimilarGames] Adding ${uniqueIds.length} games to similar games pending set`
  );

  // Check which games are already processed or pending
  const alreadyProcessed = await redis.smembers(SIMILAR_GAMES_PROCESSED);
  const alreadyPending = await redis.smembers(SIMILAR_GAMES_SET);

  // Filter out games that are already processed or pending
  const newGameIds = uniqueIds.filter(
    (id) =>
      !alreadyProcessed.includes(id.toString()) &&
      !alreadyPending.includes(id.toString())
  );

  if (newGameIds.length === 0) {
    console.log(`[SimilarGames] All games already processed or pending`);
    return;
  }

  // Add to pending set
  await redis.sadd(SIMILAR_GAMES_SET, ...newGameIds.map((id) => id.toString()));
  console.log(
    `[SimilarGames] Added ${newGameIds.length} new games to pending set`
  );
};

/**
 * Process a batch of similar games from the pending set
 * @param batchSize Number of games to process in one batch
 */
export const processSimilarGamesBatch = async (
  batchSize: number = 5
): Promise<void> => {
  const redis = getRedisClient();

  // Check if system is busy with higher priority tasks
  const sqliteWriteQueue = new RedisQueue("sqlite_write");
  const mainQueueLength = await sqliteWriteQueue.getQueueLength();
  const mainProcessingLength = await sqliteWriteQueue.getProcessingLength();

  if (mainQueueLength + mainProcessingLength > SYSTEM_BUSY_THRESHOLD) {
    console.log(
      `[SimilarGames] System busy with ${
        mainQueueLength + mainProcessingLength
      } main tasks, skipping similar games processing`
    );
    return;
  }

  // Get a batch of game IDs from the pending set
  const gameIds = await redis.spop(SIMILAR_GAMES_SET, batchSize);

  if (!gameIds || gameIds.length === 0) {
    console.log(`[SimilarGames] No pending similar games to process`);
    return;
  }

  console.log(`[SimilarGames] Processing batch of ${gameIds.length} games`);

  // Process each game
  for (const gameId of gameIds) {
    try {
      await processSimilarGame(parseInt(gameId));
      // Mark as processed
      await redis.sadd(SIMILAR_GAMES_PROCESSED, gameId);
    } catch (error) {
      console.error(`[SimilarGames] Error processing game ${gameId}:`, error);
      // Put back in pending set if failed
      await redis.sadd(SIMILAR_GAMES_SET, gameId);
    }
  }
};

/**
 * Process similar games for a specific game ID
 * @param gameId The game ID to fetch similar games for
 */
async function processSimilarGame(gameId: number): Promise<void> {
  console.log(`[SimilarGames] Processing similar games for game ID: ${gameId}`);

  // First check if we already have the game in our database
  const existingGame = await db.query.game.findFirst({
    where: eq(game.id, gameId),
    columns: {
      id: true,
      name: true,
    },
  });

  if (!existingGame) {
    console.log(
      `[SimilarGames] Game ${gameId} not found in database, fetching from IGDB`
    );
    // Fetch the game from IGDB
    const results = await searchIGDB(`id = ${gameId}`, true);

    if (results.length === 0) {
      console.log(`[SimilarGames] Game ${gameId} not found in IGDB`);
      return;
    }

    // Queue the game for writing to SQLite
    await enqueueGameWrite(results[0] as IGDBGameResponse);

    // If the game has similar games, queue them too
    if (results[0].similar_games && results[0].similar_games.length > 0) {
      await enqueueSimilarGames(results[0].similar_games);
    }

    return;
  }

  // Get existing similar game relationships
  const existingRelations = await db.query.gameToSimilarGame.findMany({
    where: eq(gameToSimilarGame.gameId, gameId),
    columns: {
      similarGameId: true,
    },
  });

  const existingRelationIds = new Set(
    existingRelations.map((rel) => rel.similarGameId)
  );

  // If we have the game but no similar games relationships, fetch them
  if (existingRelationIds.size === 0) {
    console.log(
      `[SimilarGames] Game ${gameId} exists but has no similar games relationships, fetching from IGDB`
    );
    const results = await searchIGDB(`id = ${gameId}`, true);

    if (results.length === 0 || !results[0].similar_games) {
      console.log(`[SimilarGames] No similar games found for game ${gameId}`);
      return;
    }

    // Create the relationships in the many-to-many table
    if (results[0].similar_games && results[0].similar_games.length > 0) {
      console.log(
        `[SimilarGames] Creating ${results[0].similar_games.length} similar game relationships for game ${gameId}`
      );

      // Insert relationships in batches to avoid too many parameters
      const BATCH_SIZE = 50;
      for (let i = 0; i < results[0].similar_games.length; i += BATCH_SIZE) {
        const batch = results[0].similar_games.slice(i, i + BATCH_SIZE);

        const values = batch.map((similarGameId) => ({
          gameId,
          similarGameId,
          createdAt: Math.floor(Date.now() / 1000),
        }));

        await db.insert(gameToSimilarGame).values(values).onConflictDoNothing();
      }
    }

    // Queue the similar games for processing
    await enqueueSimilarGames(results[0].similar_games);
    return;
  }

  // Process the similar games from relations
  const similarGameIds = Array.from(existingRelationIds);

  if (similarGameIds.length > 0) {
    console.log(
      `[SimilarGames] Processing ${similarGameIds.length} similar games for game ${gameId}`
    );

    // Check which similar games we already have in our database
    const existingGameIds = await db.query.game.findMany({
      where: (fields, { inArray }) => inArray(fields.id, similarGameIds),
      columns: { id: true },
    });

    const existingIds = new Set(existingGameIds.map((g) => g.id));
    const missingIds = similarGameIds.filter((id) => !existingIds.has(id));

    if (missingIds.length === 0) {
      console.log(
        `[SimilarGames] All similar games for ${gameId} already exist in database`
      );
      return;
    }

    console.log(
      `[SimilarGames] Fetching ${missingIds.length} missing similar games for game ${gameId}`
    );

    // Fetch missing games in batches to avoid overloading IGDB API
    const BATCH_SIZE = 5;
    for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
      const batch = missingIds.slice(i, i + BATCH_SIZE);
      const idString = batch.join(",");

      // Fetch the batch from IGDB
      const results = await searchIGDB(`id = (${idString})`, true);

      // Queue each game for writing to SQLite
      for (const gameData of results) {
        await enqueueGameWrite(gameData as IGDBGameResponse);
      }

      // If we're not at the last batch, wait a bit to avoid rate limiting
      if (i + BATCH_SIZE < missingIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

/**
 * Start the background worker for processing similar games
 */
export const startSimilarGamesWorker = async (
  intervalMs: number = 60000, // Default: run every minute
  batchSize: number = 5 // Default: process 5 games per batch
): Promise<NodeJS.Timer> => {
  console.log(
    `[SimilarGames] Starting similar games worker (interval: ${intervalMs}ms, batch size: ${batchSize})`
  );

  // Initial run
  await processSimilarGamesBatch(batchSize);

  // Schedule recurring runs
  const intervalId = setInterval(async () => {
    try {
      await processSimilarGamesBatch(batchSize);
    } catch (error) {
      console.error(`[SimilarGames] Error in worker:`, error);
    }
  }, intervalMs);

  return intervalId;
};

/**
 * Stop the background worker
 */
export const stopSimilarGamesWorker = (intervalId: NodeJS.Timer): void => {
  console.log(`[SimilarGames] Stopping similar games worker`);
  clearInterval(intervalId);
};

/**
 * Get statistics about the similar games queue
 */
export const getSimilarGamesStats = async (): Promise<{
  pendingCount: number;
  processedCount: number;
  queueLength: number;
  processingLength: number;
}> => {
  const redis = getRedisClient();

  const [pendingCount, processedCount, queueLength, processingLength] =
    await Promise.all([
      redis.scard(SIMILAR_GAMES_SET),
      redis.scard(SIMILAR_GAMES_PROCESSED),
      similarGamesQueue.getQueueLength(),
      similarGamesQueue.getProcessingLength(),
    ]);

  return {
    pendingCount,
    processedCount,
    queueLength,
    processingLength,
  };
};
