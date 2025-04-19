import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { zodToJsonSchema } from "zod-to-json-schema";

import { db as postgresDb } from "@/db/postgres";
import { db as sqliteDb } from "@/db/sqlite";
import { userGames, user } from "@/db/postgres/schema";
import { transformGameResponse } from "@/utils/gameTransformers";
import {
  InternalServerErrorResponseSchema,
  NotFoundErrorResponseSchema,
} from "@/schemas/error";
import { UserGameResponseSchema } from "@/schemas/userGame";

export const getUserGames = new Elysia().get(
  "/user/:username/games",
  async ({ params, set }) => {
    try {
      const { username } = params;

      const userData = await postgresDb.query.user.findFirst({
        where: eq(user.username, username),
      });

      if (!userData) {
        set.status = 404;
        return { error: "User not found" };
      }

      const userGamesList = await postgresDb.query.userGames.findMany({
        where: eq(userGames.userId, userData.id),
      });

      const gameIds = userGamesList.map((ug) => ug.gameId);

      if (gameIds.length === 0) {
        return {
          games: [],
          meta: { total: 0 },
        };
      }

      const games = await sqliteDb.query.game.findMany({
        where: (game, { inArray }) => inArray(game.id, gameIds),
        with: {
          cover: true,
          screenshots: true,
          websites: true,
          platforms: { with: { platform: true } },
          genres: { with: { genre: true } },
          types: { with: { type: true } },
          similarGames: { with: { similarGame: true } },
        },
      });

      const gamesWithUserData = games.map((game) => {
        const userGame = userGamesList.find((ug) => ug.gameId === game.id);
        return {
          ...transformGameResponse(game),
          userGameData: {
            status: userGame?.status,
            rating: userGame?.rating,
            review: userGame?.review,
            platformId: userGame?.platformId,
            addedAt: userGame?.addedAt,
            source: userGame?.source,
          },
        };
      });

      return {
        games: gamesWithUserData,
        meta: { total: gamesWithUserData.length },
      };
    } catch (error) {
      console.error("Error fetching user games:", error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  },
  {
    params: t.Object({
      username: t.String(),
    }),
    detail: {
      tags: ["User"],
      summary: "Get all games for a user by username",
      description:
        "Retrieves all games in a user's library with their statuses, ratings, and reviews",
      responses: {
        200: {
          description: "List of games returned",
          content: {
            "application/json": {
              schema: zodToJsonSchema(UserGameResponseSchema) as any,
            },
          },
        },
        404: {
          description: "User not found",
          content: {
            "application/json": {
              schema: NotFoundErrorResponseSchema,
            },
          },
        },
        500: {
          description: "Internal server error",
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
