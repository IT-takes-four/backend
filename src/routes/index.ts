import { Elysia } from "elysia";

import { getMe } from "./me/GET";

import { getUser } from "./user/[username]/GET";

import { getGames } from "./games/GET";
import { getGameById } from "./games/[id]/GET";
import { getGamesSearch } from "./games/search/GET";
import { getUserGames } from "./user/[username]/games/GET";
import { postUserGame } from "./user/[username]/games/POST";
import { deleteUserGame } from "./user/[username]/games/[id]/DELETE";
import { patchUserGame } from "./user/[username]/games/[id]/PATCH";

export const routes = new Elysia()
  .use(getMe)

  .use(getUser)

  .use(getGames)
  .use(getGameById)
  .use(getGamesSearch)

  .use(getUserGames)
  .use(postUserGame)
  .use(patchUserGame)
  .use(deleteUserGame);
