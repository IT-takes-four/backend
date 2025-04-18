import { Elysia } from "elysia";

import { getAllGames } from "./getAllGames";
import { getUser } from "./getUser";

export const userRouter = new Elysia({ prefix: "/user" })
  .use(getAllGames)
  .use(getUser);
