import { Elysia } from "elysia";
import { eq } from "drizzle-orm";

import { db, game } from "../../db";
import { transformGameResponse } from "./utils";

export const getGameById = new Elysia().get("/:id", async ({ params }) => {
  const { id } = params;

  const gameData = await db.query.game.findFirst({
    where: eq(game.id, parseInt(id)),
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
      similarGames: {
        with: {
          similarGame: true,
        },
      },
    },
  });

  if (!gameData) {
    return { error: `Game with id ${id} not found` };
  }

  return transformGameResponse(gameData);
});
