import { Elysia, t } from "elysia";

import { searchGamesWithCache } from "@/utils/searchGames";

export const getGamesSearch = new Elysia().get(
  "/games/search",
  async ({ query }) => {
    const searchQuery = query?.q as string;
    const limit = query?.limit ? query.limit : 50;
    const offset = query?.offset ? query.limit : 0;
    const forceFresh = query?.fresh === "true" || query?.fresh === "1";

    const results = await searchGamesWithCache(
      searchQuery,
      limit,
      offset,
      forceFresh
    );
    return results;
  },
  {
    query: t.Object({
      q: t.String(),
      limit: t.Optional(t.Numeric()),
      offset: t.Optional(t.Numeric()),
      fresh: t.Optional(t.String()),
    }),
  }
);
