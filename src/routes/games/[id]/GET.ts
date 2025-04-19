import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { zodToJsonSchema } from "zod-to-json-schema";

import { db } from "@/db/sqlite";
import { game } from "@/db/sqlite/schema";
import { transformGameResponse } from "@/utils/gameTransformers";
import {
  InternalServerErrorResponseSchema,
  NotFoundErrorResponseSchema,
  BadRequestErrorResponseSchema,
} from "@/schemas/error";
import { GameResponseSchema } from "@/schemas/game";

export const getGameById = new Elysia().get(
  "/games/:id",
  async ({ params, set }) => {
    const gameId = Number(params.id);

    if (Number.isNaN(gameId)) {
      set.status = 400;
      return { error: "Invalid game ID" };
    }

    const result = await db.query.game.findFirst({
      where: eq(game.id, gameId),
      with: {
        cover: true,
        screenshots: true,
        websites: true,
        platforms: { with: { platform: true } },
        genres: { with: { genre: true } },
        types: { with: { type: true } },
        similarGames: { with: { similarGame: true } },
      },
    });

    if (!result) {
      set.status = 404;
      return { error: "Game not found" };
    }

    return transformGameResponse(result);
  },
  {
    params: t.Object({
      id: t.Numeric(),
    }),
    detail: {
      tags: ["Games"],
      summary: "Get game by ID",
      description: "Returns full info about a game from the catalog by its ID.",
      responses: {
        200: {
          description: "Game found",
          content: {
            "application/json": {
              schema: zodToJsonSchema(GameResponseSchema) as any,
            },
          },
        },
        400: {
          description: "Bad request",
          content: {
            "application/json": {
              schema: BadRequestErrorResponseSchema,
            },
          },
        },
        404: {
          description: "Game not found",
          content: {
            "application/json": {
              schema: NotFoundErrorResponseSchema,
            },
          },
        },
        500: {
          description: "Unexpected error",
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
