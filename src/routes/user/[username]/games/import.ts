import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import { db as sqliteDb } from "@/db/sqlite";
import { userGames, user as userSchema } from "@/db/postgres/schema";
import { betterAuth } from "@/lib/betterAuth";
import { createLogger } from "@/utils/enhancedLogger";
import { fetchIGDBByIds } from "@/utils/igdb/utils";
import { enqueueGameWrite } from "@/utils/redis/sqliteWriter";

const logger = createLogger("user-import-games");

function parseCSV(csvContent: string): any[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, ""));
  const games: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          // Escaped quote
          current += '"';
          j++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const game: any = {};
    headers.forEach((header, index) => {
      const value = values[index] || "";

      switch (header) {
        case "gameId":
          game.gameId = parseInt(value) || 0;
          break;
        case "gameName":
          break;
        case "status":
          game.status = value;
          break;
        case "rating":
          game.rating = value ? parseFloat(value) : null;
          break;
        case "review":
          game.review = value || null;
          break;
        case "platformId":
          game.platformId = parseInt(value) || 0;
          break;
        case "endedAt":
          game.endedAt = value && value.trim() !== "" ? value : null;
          break;
        default:
          break;
      }
    });

    if (game.gameId && game.status) {
      games.push(game);
    }
  }

  return games;
}

function validateGameData(game: any): { valid: boolean; error?: string } {
  if (!game.gameId || typeof game.gameId !== "number") {
    return { valid: false, error: "Invalid or missing gameId" };
  }

  const validStatuses = [
    "finished",
    "playing",
    "dropped",
    "online",
    "on_hold",
    "want_to_play",
    "backlog",
  ];
  if (!game.status || !validStatuses.includes(game.status)) {
    return { valid: false, error: "Invalid or missing status" };
  }

  if (!game.platformId || typeof game.platformId !== "number") {
    return { valid: false, error: "Invalid or missing platformId" };
  }

  if (game.rating !== null && game.rating !== undefined) {
    const rating = Number(game.rating);
    if (isNaN(rating) || rating < 0 || rating > 10) {
      return { valid: false, error: "Rating must be between 0 and 10" };
    }
  }

  // Validate endedAt logic: should only be present for finished or dropped games
  if (game.endedAt && !["finished", "dropped"].includes(game.status)) {
    return {
      valid: false,
      error:
        "endedAt can only be set for games with status 'finished' or 'dropped'",
    };
  }

  return { valid: true };
}

async function fetchAndSaveGameFromIGDB(gameId: number): Promise<boolean> {
  try {
    logger.info(`Fetching game ${gameId} from IGDB`);

    const igdbGames = await fetchIGDBByIds([gameId]);

    if (igdbGames.length === 0) {
      logger.warn(`Game ${gameId} not found in IGDB`);
      return false;
    }

    const igdbGame = igdbGames[0];

    // Enqueue the game to be saved to our database
    await enqueueGameWrite(igdbGame);

    logger.info(
      `Successfully enqueued game ${gameId} (${igdbGame.name}) for saving`
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      `Failed to fetch and save game ${gameId} from IGDB: ${errorMessage}`
    );
    return false;
  }
}

export const importUserGames = new Elysia().use(betterAuth).post(
  "/user/:username/games/import",
  async ({ params, user, body, set }) => {
    try {
      const { username } = params;

      if (username !== user.username) {
        set.status = 403;
        return {
          error: "Forbidden",
          message: "You can only import games to your own library",
        };
      }

      const userData = await postgresDb.query.user.findFirst({
        where: eq(userSchema.username, username),
      });

      if (!userData) {
        set.status = 404;
        return { error: "Not found", message: "User not found" };
      }

      let gamesToImport: any[] = [];
      let overwriteExisting = false;

      if (body && typeof body === "object") {
        if ("games" in body && Array.isArray(body.games)) {
          gamesToImport = body.games;
          overwriteExisting = body.overwriteExisting || false;
        } else if ("file" in body && body.file) {
          const file = body.file as File;

          // Limit file size to prevent memory issues (10MB)
          const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
          if (file.size > MAX_FILE_SIZE) {
            set.status = 400;
            return {
              error: "Bad request",
              message: `File too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB, provided: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            };
          }

          const content = await file.text();

          if (file.type === "text/csv" || file.name.endsWith(".csv")) {
            gamesToImport = parseCSV(content);
          } else {
            try {
              const jsonData = JSON.parse(content);
              if (jsonData.games && Array.isArray(jsonData.games)) {
                gamesToImport = jsonData.games;
              } else if (Array.isArray(jsonData)) {
                gamesToImport = jsonData;
              } else {
                set.status = 400;
                return {
                  error: "Bad request",
                  message:
                    "Invalid file format. Expected JSON with 'games' array or CSV format",
                };
              }
            } catch (parseError) {
              set.status = 400;
              return {
                error: "Bad request",
                message: "Invalid JSON format in uploaded file",
              };
            }
          }

          overwriteExisting =
            body.overwriteExisting === "true" ||
            body.overwriteExisting === true;
        }
      }

      if (!gamesToImport.length) {
        set.status = 400;
        return {
          error: "Bad request",
          message: "No games provided for import",
        };
      }

      // Limit the number of games that can be imported in a single request
      const MAX_IMPORT_GAMES = 1000;
      if (gamesToImport.length > MAX_IMPORT_GAMES) {
        set.status = 400;
        return {
          error: "Bad request",
          message: `Too many games to import. Maximum allowed: ${MAX_IMPORT_GAMES}, provided: ${gamesToImport.length}`,
        };
      }

      const results = {
        imported: 0,
        skipped: 0,
        errors: 0,
        fetchedFromIGDB: 0,
        details: {
          importedGames: [] as number[],
          skippedGames: [] as { gameId: number; reason: string }[],
          errorGames: [] as { gameId: number; error: string }[],
          fetchedFromIGDBGames: [] as number[],
        },
      };

      for (const gameData of gamesToImport) {
        const validation = validateGameData(gameData);

        if (!validation.valid) {
          results.errors++;
          results.details.errorGames.push({
            gameId: gameData.gameId || 0,
            error: validation.error || "Unknown validation error",
          });
          continue;
        }

        try {
          let gameExists = await sqliteDb.query.game.findFirst({
            where: (game, { eq }) => eq(game.id, gameData.gameId),
          });

          if (!gameExists) {
            // Try to fetch and save the game from IGDB
            logger.info(
              `Game ${gameData.gameId} not found in local database, attempting to fetch from IGDB`
            );

            const fetchedFromIGDB = await fetchAndSaveGameFromIGDB(
              gameData.gameId
            );

            if (fetchedFromIGDB) {
              // Wait for the game to be processed by the queue with retries
              let retries = 0;
              const maxRetries = 5;
              const retryDelay = 500; // Start with 500ms

              while (retries < maxRetries && !gameExists) {
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay * (retries + 1))
                );

                gameExists = await sqliteDb.query.game.findFirst({
                  where: (game, { eq }) => eq(game.id, gameData.gameId),
                });

                retries++;
              }
            }

            if (!gameExists) {
              results.errors++;
              results.details.errorGames.push({
                gameId: gameData.gameId,
                error:
                  "Game not found in database and could not be fetched from IGDB",
              });
              continue;
            } else {
              results.fetchedFromIGDB++;
              results.details.fetchedFromIGDBGames.push(gameData.gameId);
              logger.info(
                `Successfully fetched and saved game ${gameData.gameId} from IGDB`
              );
            }
          }

          const existingUserGame = await postgresDb.query.userGames.findFirst({
            where: and(
              eq(userGames.userId, userData.id),
              eq(userGames.gameId, gameData.gameId)
            ),
          });

          if (existingUserGame && !overwriteExisting) {
            results.skipped++;
            results.details.skippedGames.push({
              gameId: gameData.gameId,
              reason: "Game already exists in library",
            });
            continue;
          }

          const shouldSetEndedAt = ["finished", "dropped"].includes(
            gameData.status
          );
          const endedAtValue =
            shouldSetEndedAt && gameData.endedAt
              ? new Date(gameData.endedAt)
              : null;

          const gameToSave = {
            userId: userData.id,
            gameId: gameData.gameId,
            status:
              gameData.status as (typeof userGames.status)["enumValues"][number],
            rating: gameData.rating?.toString(),
            review: gameData.review,
            platformId: gameData.platformId,
            endedAt: endedAtValue,
            source: "manual" as const,
          };

          if (existingUserGame && overwriteExisting) {
            // Update existing game
            await postgresDb
              .update(userGames)
              .set({
                status: gameToSave.status,
                rating: gameToSave.rating || null,
                review: gameToSave.review || null,
                platformId: gameToSave.platformId,
                endedAt: gameToSave.endedAt || null,
              })
              .where(
                and(
                  eq(userGames.userId, userData.id),
                  eq(userGames.gameId, gameData.gameId)
                )
              );
          } else {
            // Insert new game
            await postgresDb.insert(userGames).values({
              userId: gameToSave.userId,
              gameId: gameToSave.gameId,
              status: gameToSave.status,
              rating: gameToSave.rating || null,
              review: gameToSave.review || null,
              platformId: gameToSave.platformId,
              endedAt: gameToSave.endedAt || null,
              source: gameToSave.source,
            });
          }

          results.imported++;
          results.details.importedGames.push(gameData.gameId);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(
            `Failed to import game ${gameData.gameId}: ${errorMessage}`
          );
          results.errors++;
          results.details.errorGames.push({
            gameId: gameData.gameId,
            error: "Database error during import",
          });
        }
      }

      return {
        message: `Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.errors} errors, ${results.fetchedFromIGDB} fetched from IGDB`,
        imported: results.imported,
        skipped: results.skipped,
        errors: results.errors,
        fetchedFromIGDB: results.fetchedFromIGDB,
        details: results.details,
      };
    } catch (error) {
      logger.exception(error);
      set.status = 500;
      return {
        error: "Internal server error",
        message: "Failed to import games",
      };
    }
  },
  {
    auth: true,
    params: t.Object({
      username: t.String(),
    }),
    body: t.Union([
      t.Object({
        games: t.Array(
          t.Object({
            gameId: t.Number(),
            status: t.String(),
            rating: t.Optional(t.Union([t.Number(), t.Null()])),
            review: t.Optional(t.Union([t.String(), t.Null()])),
            platformId: t.Number(),
            endedAt: t.Optional(t.Union([t.String(), t.Null()])),
          })
        ),
        overwriteExisting: t.Optional(t.Boolean()),
      }),
      t.Object({
        file: t.File(),
        overwriteExisting: t.Optional(t.Union([t.String(), t.Boolean()])),
      }),
    ]),
  }
);
