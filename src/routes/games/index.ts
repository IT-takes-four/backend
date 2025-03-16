import { Elysia } from "elysia";

import { getAllGames } from "./getAll";
import { getGameById } from "./getById";

export const gamesRouter = new Elysia({ prefix: "/games" })
  .use(getAllGames)
  .use(getGameById);
