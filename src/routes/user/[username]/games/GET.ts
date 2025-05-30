import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import { db as sqliteDb } from "@/db/sqlite";
import { userGames, user } from "@/db/postgres/schema";
import { transformGameResponse } from "@/utils/gameTransformers";

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
        return { error: "Not found", message: "User not found" };
      }

      const userGamesList = await postgresDb.query.userGames.findMany({
        where: eq(userGames.userId, userData.id),
      });

      const gameIds = userGamesList.map((ug) => ug.gameId);

      if (gameIds.length === 0) {
        return {
          results: [],
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
            rating: userGame?.rating ? Number(userGame.rating) : null,
            review: userGame?.review,
            platformId: userGame?.platformId,
            addedAt: userGame?.addedAt,
            endedAt: userGame?.endedAt,
            source: userGame?.source,
          },
        };
      });

      return {
        results: gamesWithUserData,
        meta: { total: gamesWithUserData.length },
      };
    } catch (error) {
      console.error("Error fetching user games:", error);
      set.status = 500;
      return {
        error: "Internal server error",
        message: "Failed to fetch user games",
      };
    }
  },
  {
    params: t.Object({
      username: t.String(),
    }),
  }
);
