import { Elysia } from "elysia";

import { db } from "../../db";
import { transformGameResponse } from "./utils";

export const getAllGames = new Elysia().get("/", async () => {
  const games = await db.query.game.findMany({
    limit: 100,
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
      types: {
        with: {
          type: true,
        },
      },
      similarGames: {
        with: {
          similarGame: true,
        },
      },
    },
  });

  return games.map(transformGameResponse);
});
