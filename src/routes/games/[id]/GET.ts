import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db } from "@/db/sqlite";
import { game } from "@/db/sqlite/schema";
import { transformGameResponse } from "@/utils/gameTransformers";

export const getGameById = new Elysia().get(
  "/games/:id",
  async ({ params, set }) => {
    const gameId = Number(params.id);

    if (Number.isNaN(gameId)) {
      set.status = 400;
      return { error: "Bad request", message: "Invalid game ID" };
    }

    const result = await db.query.game.findFirst({
      where: eq(game.id, gameId),
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

    if (!result) {
      set.status = 404;
      return { error: "Not found", message: "Game not found" };
    }

    return transformGameResponse(result);
  },
  {
    params: t.Object({
      id: t.Numeric(),
    }),
  }
);
