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
      return { error: "Invalid game ID" };
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
      return { error: "Game not found" };
    }

    return transformGameResponse(result);
  },
  {
    params: t.Object({
      id: t.Numeric(),
    }),
    detail: {
      tags: ["games"],
      summary: "Get game by ID",
      description: "Returns full info about a game from the catalog by its ID.",
      responses: {
        200: { description: "Game found" },
        400: { description: "Invalid game ID" },
        404: { description: "Game not found" },
        500: { description: "Server error" },
      },
    },
  }
);
