import { Elysia, t } from "elysia";

import { GameListResponseSchema } from "@/schemas/game";
import { InternalServerErrorResponseSchema } from "@/schemas/error";
import { BadRequestErrorResponseSchema } from "@/schemas/error";
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
    detail: {
      tags: ["Games"],
      summary: "Search games by name",
      description:
        "Performs full-text search against local DB and IGDB fallback. Uses caching and queues.",
      responses: {
        200: {
          description: "List of matched games",
          content: {
            "application/json": {
              schema: GameListResponseSchema,
            },
          },
        },
        400: {
          description: "Missing or invalid query",
          content: {
            "application/json": {
              schema: BadRequestErrorResponseSchema,
            },
          },
        },
        500: {
          description: "Server error",
          content: {
            "application/json": {
              schema: InternalServerErrorResponseSchema,
            },
          },
        },
      },
    },
  }
);
