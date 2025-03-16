import { Elysia } from "elysia";

import { getAllIGDB } from "./getAll";

export const igdbRouter = new Elysia({ prefix: "/igdb" }).use(getAllIGDB);
