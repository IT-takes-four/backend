import { eq } from "drizzle-orm";

import { db } from "../../db";
import { RedisQueue, QueueJob } from "./redisQueue";
import { getRedisClient } from "./redisClient";
import { IGDBGameResponse } from "../../routes/igdb/types";
import { transformIGDBResponse } from "../../routes/igdb/transformers";

import {
  game,
  cover,
  screenshot,
  website,
  gameToPlatform,
  gameToGenre,
  gameToGameMode,
  platform,
  genre,
  gameMode,
} from "../../db/schema";
import { storeSimilarGameRelationship } from "./similarGamesQueue";

const sqliteWriteQueue = new RedisQueue("sqlite_write");

export const JOB_TYPES = {
  INSERT_GAME: "insert_game",
  INSERT_GAMES_BATCH: "insert_games_batch",
  UPDATE_GAME: "update_game",
};

export const enqueueGameWrite = async (game: IGDBGameResponse) => {
  const transformedGame = transformIGDBResponse(game);
  return sqliteWriteQueue.enqueue(JOB_TYPES.INSERT_GAME, transformedGame);
};

export const enqueueGamesBatchWrite = async (
  games: any[],
  searchId: string
) => {
  return sqliteWriteQueue.enqueue(JOB_TYPES.INSERT_GAMES_BATCH, {
    games,
    searchId,
  });
};

const processJob = async (job: QueueJob): Promise<void> => {
  console.log(`Processing job ${job.id} of type ${job.type}`);

  try {
    switch (job.type) {
      case JOB_TYPES.INSERT_GAME:
        await insertGame(job.data);
        break;

      case JOB_TYPES.INSERT_GAMES_BATCH:
        await insertGamesBatch(job.data.games, job.data.searchId);
        break;

      case JOB_TYPES.UPDATE_GAME:
        await updateGame(job.data);
        break;

      default:
        console.warn(`Unknown job type: ${job.type}`);
    }

    await sqliteWriteQueue.complete(job.id);
  } catch (error) {
    console.error(`Error processing job ${job.id}:`, error);
    await sqliteWriteQueue.fail(job.id, error as Error);
  }
};

const insertGame = async (gameData: any) => {
  console.log(`Processing game: ${gameData.name}`);

  try {
    // Check if game already exists outside transaction
    const existingGame = await db.query.game.findFirst({
      where: eq(game.id, gameData.id),
    });

    if (existingGame) {
      console.log(`Game ${gameData.name} already exists, skipping update`);
      return; // Skip update completely
    }

    // Only proceed with insert for new games
    await db.transaction(async (tx) => {
      // Insert new game
      await tx.insert(game).values({
        id: gameData.id,
        name: gameData.name,
        slug: gameData.slug,
        summary: gameData.summary,
        storyline: gameData.storyline,
        firstReleaseDate: gameData.first_release_date,
        totalRating: gameData.total_rating,
        involvedCompanies: gameData.involved_companies,
        keywords: gameData.keywords,
        createdAt: Math.floor(Date.now() / 1000),
        updatedAt: Math.floor(Date.now() / 1000),
        isPopular: gameData.isPopular || false,
      });

      // Handle cover image
      if (gameData.cover) {
        await tx.insert(cover).values({
          gameId: gameData.id,
          url: gameData.cover.url,
          width: gameData.cover.width,
          height: gameData.cover.height,
        });
      }

      // Handle screenshots
      if (gameData.screenshots && gameData.screenshots.length > 0) {
        // Insert screenshots
        for (const screenshotData of gameData.screenshots) {
          await tx.insert(screenshot).values({
            gameId: gameData.id,
            url: screenshotData.url,
            width: screenshotData.width,
            height: screenshotData.height,
          });
        }
      }

      // Handle websites
      if (gameData.websites && gameData.websites.length > 0) {
        // Insert websites
        for (const websiteData of gameData.websites) {
          await tx.insert(website).values({
            gameId: gameData.id,
            url: websiteData.url,
            trusted: websiteData.trusted || false,
            typeId:
              typeof websiteData.type === "number" ? websiteData.type : null,
          });
        }
      }

      // Handle platforms (many-to-many)
      if (gameData.platforms && gameData.platforms.length > 0) {
        // Insert platforms that don't exist yet
        for (const platformData of gameData.platforms) {
          // Check if platform exists
          const existingPlatform = await tx.query.platform.findFirst({
            where: eq(platform.slug, platformData.slug),
          });

          let platformId;
          if (existingPlatform) {
            platformId = existingPlatform.id;
          } else {
            // Insert new platform
            const result = await tx
              .insert(platform)
              .values({
                name: platformData.name,
                slug: platformData.slug,
              })
              .returning({ id: platform.id });
            platformId = result[0].id;
          }

          // Create relationship
          await tx.insert(gameToPlatform).values({
            gameId: gameData.id,
            platformId: platformId,
          });
        }
      }

      // Handle genres (many-to-many)
      if (gameData.genres && gameData.genres.length > 0) {
        // Insert genres that don't exist yet
        for (const genreData of gameData.genres) {
          // Check if genre exists
          const existingGenre = await tx.query.genre.findFirst({
            where: eq(genre.slug, genreData.slug),
          });

          let genreId;
          if (existingGenre) {
            genreId = existingGenre.id;
          } else {
            // Insert new genre
            const result = await tx
              .insert(genre)
              .values({
                name: genreData.name,
                slug: genreData.slug,
              })
              .returning({ id: genre.id });
            genreId = result[0].id;
          }

          // Create relationship
          await tx.insert(gameToGenre).values({
            gameId: gameData.id,
            genreId: genreId,
          });
        }
      }

      // Handle game modes (many-to-many)
      if (gameData.game_modes && gameData.game_modes.length > 0) {
        // Insert game modes that don't exist yet
        for (const gameModeData of gameData.game_modes) {
          // Check if game mode exists
          const existingGameMode = await tx.query.gameMode.findFirst({
            where: eq(gameMode.slug, gameModeData.slug),
          });

          let gameModeId;
          if (existingGameMode) {
            gameModeId = existingGameMode.id;
          } else {
            // Insert new game mode
            const result = await tx
              .insert(gameMode)
              .values({
                name: gameModeData.name,
                slug: gameModeData.slug,
              })
              .returning({ id: gameMode.id });
            gameModeId = result[0].id;
          }

          // Create relationship
          await tx.insert(gameToGameMode).values({
            gameId: gameData.id,
            gameModeId: gameModeId,
          });
        }
      }
    });

    // Handle similar games relationships in a separate transaction
    if (gameData.similar_games && gameData.similar_games.length > 0) {
      // Store similar game relationships in Redis for background processing
      await storeSimilarGameRelationship(gameData.id, gameData.similar_games);
      console.log(
        `Queued ${gameData.similar_games.length} similar game relationships for ${gameData.name}`
      );
    }

    console.log(`Successfully inserted new game: ${gameData.name}`);
  } catch (error) {
    console.error(`Error processing game ${gameData.name}:`, error);
    throw error;
  }
};

const insertGamesBatch = async (games: any[], searchId: string) => {
  console.log(
    `Processing batch of ${games.length} games for search ${searchId}`
  );
  const redis = getRedisClient();

  try {
    // Filter out games that already exist
    const gameIds = games.map((g) => g.id);
    const existingGames = await db.query.game.findMany({
      where: (fields, { inArray }) => inArray(fields.id, gameIds),
      columns: { id: true },
    });

    const existingGameIds = new Set(existingGames.map((g) => g.id));
    const newGames = games.filter((g) => !existingGameIds.has(g.id));

    console.log(
      `Found ${existingGameIds.size} existing games, inserting ${newGames.length} new games`
    );

    if (newGames.length === 0) {
      console.log(
        `All games already exist for search ${searchId}, skipping batch insert`
      );
      await redis.set(`write_status:${searchId}`, "complete", "EX", 3600); // 1 hour TTL
      return;
    }

    // Start a transaction for batch processing of new games only
    await db.transaction(async (tx) => {
      for (const gameData of newGames) {
        // Insert new game
        await tx.insert(game).values({
          id: gameData.id,
          name: gameData.name,
          slug: gameData.slug,
          summary: gameData.summary,
          storyline: gameData.storyline,
          firstReleaseDate: gameData.first_release_date,
          totalRating: gameData.total_rating,
          involvedCompanies: gameData.involved_companies,
          keywords: gameData.keywords,
          createdAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
          isPopular: gameData.isPopular || false,
        });

        // Handle cover image
        if (gameData.cover) {
          await tx.insert(cover).values({
            gameId: gameData.id,
            url: gameData.cover.url,
            width: gameData.cover.width,
            height: gameData.cover.height,
          });
        }

        // Handle screenshots
        if (gameData.screenshots && gameData.screenshots.length > 0) {
          // Insert new screenshots
          for (const screenshotData of gameData.screenshots) {
            await tx.insert(screenshot).values({
              gameId: gameData.id,
              url: screenshotData.url,
              width: screenshotData.width,
              height: screenshotData.height,
            });
          }
        }

        // Handle websites
        if (gameData.websites && gameData.websites.length > 0) {
          // Insert new websites
          for (const websiteData of gameData.websites) {
            await tx.insert(website).values({
              gameId: gameData.id,
              url: websiteData.url,
              trusted: websiteData.trusted || false,
              typeId:
                typeof websiteData.type === "number" ? websiteData.type : null,
            });
          }
        }

        // Handle platforms (many-to-many)
        if (gameData.platforms && gameData.platforms.length > 0) {
          for (const platformData of gameData.platforms) {
            const existingPlatform = await tx.query.platform.findFirst({
              where: eq(platform.slug, platformData.slug),
            });

            let platformId;
            if (existingPlatform) {
              platformId = existingPlatform.id;
            } else {
              // Insert new platform
              const result = await tx
                .insert(platform)
                .values({
                  name: platformData.name,
                  slug: platformData.slug,
                })
                .returning({ id: platform.id });
              platformId = result[0].id;
            }

            await tx.insert(gameToPlatform).values({
              gameId: gameData.id,
              platformId: platformId,
            });
          }
        }

        // Handle genres (many-to-many)
        if (gameData.genres && gameData.genres.length > 0) {
          // Insert genres that don't exist yet
          for (const genreData of gameData.genres) {
            // Check if genre exists
            const existingGenre = await tx.query.genre.findFirst({
              where: eq(genre.slug, genreData.slug),
            });

            let genreId;
            if (existingGenre) {
              genreId = existingGenre.id;
            } else {
              // Insert new genre
              const result = await tx
                .insert(genre)
                .values({
                  name: genreData.name,
                  slug: genreData.slug,
                })
                .returning({ id: genre.id });
              genreId = result[0].id;
            }

            // Create relationship
            await tx.insert(gameToGenre).values({
              gameId: gameData.id,
              genreId: genreId,
            });
          }
        }

        // Handle game modes (many-to-many)
        if (gameData.game_modes && gameData.game_modes.length > 0) {
          // Insert game modes that don't exist yet
          for (const gameModeData of gameData.game_modes) {
            // Check if game mode exists
            const existingGameMode = await tx.query.gameMode.findFirst({
              where: eq(gameMode.slug, gameModeData.slug),
            });

            let gameModeId;
            if (existingGameMode) {
              gameModeId = existingGameMode.id;
            } else {
              // Insert new game mode
              const result = await tx
                .insert(gameMode)
                .values({
                  name: gameModeData.name,
                  slug: gameModeData.slug,
                })
                .returning({ id: gameMode.id });
              gameModeId = result[0].id;
            }

            // Create relationship
            await tx.insert(gameToGameMode).values({
              gameId: gameData.id,
              gameModeId: gameModeId,
            });
          }
        }
      }
    });

    // After the main transaction completes, handle similar games relationships
    for (const gameData of newGames) {
      if (gameData.similar_games && gameData.similar_games.length > 0) {
        try {
          // Store similar game relationships in Redis for background processing
          await storeSimilarGameRelationship(
            gameData.id,
            gameData.similar_games
          );
          console.log(
            `Queued ${gameData.similar_games.length} similar game relationships for ${gameData.name}`
          );
        } catch (error) {
          console.error(
            `Error queueing similar games for ${gameData.name}:`,
            error
          );
          // Continue with other games
        }
      }
    }

    console.log(
      `Successfully inserted ${newGames.length} new games for search ${searchId}`
    );

    // Update the write status in Redis
    await redis.set(`write_status:${searchId}`, "complete", "EX", 3600); // 1 hour TTL
  } catch (error) {
    console.error(`Error inserting games batch for search ${searchId}:`, error);
    await redis.set(
      `write_status:${searchId}`,
      `error:${(error as Error).message}`,
      "EX",
      3600
    );
    throw error;
  }
};

const updateGame = async (gameData: any) => {
  console.log(`Checking if game needs update: ${gameData.name}`);

  try {
    // Check if game exists
    const existingGame = await db.query.game.findFirst({
      where: eq(game.id, gameData.id),
    });

    if (!existingGame) {
      console.warn(
        `Game ${gameData.name} (ID: ${gameData.id}) not found, cannot update`
      );
      return;
    }

    // Start a transaction
    await db.transaction(async (tx) => {
      // Update game
      await tx
        .update(game)
        .set({
          name: gameData.name,
          slug: gameData.slug,
          summary: gameData.summary,
          storyline: gameData.storyline,
          firstReleaseDate: gameData.first_release_date,
          totalRating: gameData.total_rating,
          involvedCompanies: gameData.involved_companies,
          keywords: gameData.keywords,
          updatedAt: Math.floor(Date.now() / 1000),
          isPopular: gameData.isPopular || false,
        })
        .where(eq(game.id, gameData.id));

      // Handle cover image
      if (gameData.cover) {
        const existingCover = await tx.query.cover.findFirst({
          where: eq(cover.gameId, gameData.id),
        });

        if (existingCover) {
          await tx
            .update(cover)
            .set({
              url: gameData.cover.url,
              width: gameData.cover.width,
              height: gameData.cover.height,
            })
            .where(eq(cover.gameId, gameData.id));
        } else {
          await tx.insert(cover).values({
            gameId: gameData.id,
            url: gameData.cover.url,
            width: gameData.cover.width,
            height: gameData.cover.height,
          });
        }
      }

      // Only update the fields that are provided in the update data
      // For related entities, only update if they are included in the update data

      // Handle screenshots if provided
      if (gameData.screenshots) {
        // Delete existing screenshots
        await tx.delete(screenshot).where(eq(screenshot.gameId, gameData.id));

        // Insert new screenshots
        if (gameData.screenshots.length > 0) {
          for (const screenshotData of gameData.screenshots) {
            await tx.insert(screenshot).values({
              gameId: gameData.id,
              url: screenshotData.url,
              width: screenshotData.width,
              height: screenshotData.height,
            });
          }
        }
      }

      // Handle websites if provided
      if (gameData.websites) {
        // Delete existing websites
        await tx.delete(website).where(eq(website.gameId, gameData.id));

        // Insert new websites
        if (gameData.websites.length > 0) {
          for (const websiteData of gameData.websites) {
            await tx.insert(website).values({
              gameId: gameData.id,
              url: websiteData.url,
              trusted: websiteData.trusted || false,
              typeId:
                typeof websiteData.type === "number" ? websiteData.type : null,
            });
          }
        }
      }

      // Handle platforms if provided
      if (gameData.platforms) {
        // Delete existing platform relationships
        await tx
          .delete(gameToPlatform)
          .where(eq(gameToPlatform.gameId, gameData.id));

        // Insert new platform relationships
        if (gameData.platforms.length > 0) {
          for (const platformData of gameData.platforms) {
            // Check if platform exists
            const existingPlatform = await tx.query.platform.findFirst({
              where: eq(platform.slug, platformData.slug),
            });

            let platformId;
            if (existingPlatform) {
              platformId = existingPlatform.id;
            } else {
              // Insert new platform
              const result = await tx
                .insert(platform)
                .values({
                  name: platformData.name,
                  slug: platformData.slug,
                })
                .returning({ id: platform.id });
              platformId = result[0].id;
            }

            // Create relationship
            await tx.insert(gameToPlatform).values({
              gameId: gameData.id,
              platformId: platformId,
            });
          }
        }
      }

      // Handle genres if provided
      if (gameData.genres) {
        // Delete existing genre relationships
        await tx.delete(gameToGenre).where(eq(gameToGenre.gameId, gameData.id));

        // Insert new genre relationships
        if (gameData.genres.length > 0) {
          for (const genreData of gameData.genres) {
            // Check if genre exists
            const existingGenre = await tx.query.genre.findFirst({
              where: eq(genre.slug, genreData.slug),
            });

            let genreId;
            if (existingGenre) {
              genreId = existingGenre.id;
            } else {
              // Insert new genre
              const result = await tx
                .insert(genre)
                .values({
                  name: genreData.name,
                  slug: genreData.slug,
                })
                .returning({ id: genre.id });
              genreId = result[0].id;
            }

            // Create relationship
            await tx.insert(gameToGenre).values({
              gameId: gameData.id,
              genreId: genreId,
            });
          }
        }
      }

      // Handle game modes if provided
      if (gameData.game_modes) {
        // Delete existing game mode relationships
        await tx
          .delete(gameToGameMode)
          .where(eq(gameToGameMode.gameId, gameData.id));

        // Insert new game mode relationships
        if (gameData.game_modes.length > 0) {
          for (const gameModeData of gameData.game_modes) {
            // Check if game mode exists
            const existingGameMode = await tx.query.gameMode.findFirst({
              where: eq(gameMode.slug, gameModeData.slug),
            });

            let gameModeId;
            if (existingGameMode) {
              gameModeId = existingGameMode.id;
            } else {
              // Insert new game mode
              const result = await tx
                .insert(gameMode)
                .values({
                  name: gameModeData.name,
                  slug: gameModeData.slug,
                })
                .returning({ id: gameMode.id });
              gameModeId = result[0].id;
            }

            // Create relationship
            await tx.insert(gameToGameMode).values({
              gameId: gameData.id,
              gameModeId: gameModeId,
            });
          }
        }
      }
    });

    console.log(`Successfully updated game: ${gameData.name}`);
  } catch (error) {
    console.error(`Error updating game ${gameData.name}:`, error);
    throw error;
  }
};

export const startSQLiteWriteWorker = async (
  pollInterval: number = 1000,
  shouldContinue: () => boolean = () => true
) => {
  console.log("Starting SQLite write worker");

  while (shouldContinue()) {
    const job = await sqliteWriteQueue.dequeue();

    if (job) {
      await processJob(job);
    } else {
      // No jobs in the queue, wait before polling again
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  console.log("SQLite write worker stopped");
};

// Helper to start the worker in the background
export const startWorkerInBackground = () => {
  // This would typically be in a separate process in production
  // For simplicity, we're just using a setTimeout here
  setTimeout(() => {
    startSQLiteWriteWorker();
  }, 0);
};

export { sqliteWriteQueue };
