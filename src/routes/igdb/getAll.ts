import { Elysia } from "elysia";

import { searchIGDB } from "./utils";

export const getAllIGDB = new Elysia().get("/search", async ({ query }) => {
  const searchQuery = query?.q as string;
  const showOnlyGames = query?.showOnlyGames !== "false";
  const limit = query?.limit ? parseInt(query.limit) : 50;
  if (!searchQuery) {
    return { error: "Search query is required" };
  }

  const results = await searchIGDB(searchQuery, showOnlyGames, limit);
  return results;
});
