import { Elysia } from "elysia";

import { db } from "../../db";
// import { getIGDBToken } from "../../utils/igdb/token";
import { transformGameResponse } from "./utils";

export const getAllGames = new Elysia().get("/", async () => {
  //   const token = await getIGDBToken();
  //   console.log({ token });
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
    },
  });

  return games.map(transformGameResponse);
});
