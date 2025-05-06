import { Elysia, t } from "elysia";
import { eq, and, inArray } from "drizzle-orm";

import { db } from "@/db/sqlite";
import { transformGameResponse } from "@/utils/gameTransformers";
import { game, gameToPlatform } from "@/db/sqlite/schema";

export const getGames = new Elysia().get(
  "/games",
  async ({ query, set }) => {
    try {
      const { limit = 100, offset = 0, platformId } = query;

      let gameIdFilter: number[] | undefined;

      if (platformId) {
        const relatedGames = await db
          .select({ gameId: gameToPlatform.gameId })
          .from(gameToPlatform)
          .where(eq(gameToPlatform.platformId, Number(platformId)));

        gameIdFilter = relatedGames.map((row) => row.gameId);

        if (gameIdFilter.length === 0) {
          return {
            games: [],
            meta: { total: 0, limit: Number(limit), offset: Number(offset) },
          };
        }
      }

      const conditions = [];

      if (gameIdFilter) {
        conditions.push(inArray(game.id, gameIdFilter));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [games, total] = await Promise.all([
        db.query.game.findMany({
          limit: Number(limit),
          offset: Number(offset),
          where: whereClause,
          with: {
            cover: true,
            screenshots: true,
            websites: true,
            platforms: { with: { platform: true } },
            genres: { with: { genre: true } },
            types: { with: { type: true } },
            similarGames: { with: { similarGame: true } },
          },
        }),

        db.query.game
          .findMany({
            where: whereClause,
            columns: { id: true },
          })
          .then((rows) => rows.length),
      ]);

      return {
        games: games.map(transformGameResponse),
        meta: {
          total,
          limit: Number(limit),
          offset: Number(offset),
        },
      };
    } catch (error) {
      console.error("Error fetching games:", error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  },
  {
    query: t.Object({
      limit: t.Optional(t.Numeric({ default: 100 })),
      offset: t.Optional(t.Numeric({ default: 0 })),
      platformId: t.Optional(t.Numeric()),
    }),
  }
);
