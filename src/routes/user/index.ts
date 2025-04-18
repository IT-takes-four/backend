import { Elysia } from "elysia";

import { getAllGames } from "./getAllGames";
import { addGame } from "./addGame";
import { removeGame } from "./removeGame";
import { getUser } from "./getUser";

export const userRouter = new Elysia({ prefix: "/user" })
  .use(getAllGames)
  .use(addGame)
  .use(removeGame)
  .use(getUser);
