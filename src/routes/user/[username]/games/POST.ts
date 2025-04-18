import { Elysia, t } from "elysia";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { betterAuth } from "@/lib/betterAuth";
import { createLogger } from "@/utils/enhancedLogger";
import {
  ConflictErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  InternalServerErrorResponseSchema,
} from "@/schemas/error";
import { BadRequestErrorResponseSchema } from "@/schemas/error";
import { UserGameInsertSchema } from "@/schemas/userGame";

const logger = createLogger("user-add-game");

export const postUserGame = new Elysia().use(betterAuth).post(
  "/user/:username/games",
  async ({ params, user, body, set }) => {
    try {
      if (params.username !== user.username) {
        set.status = 403;
        return { error: "You can only add games to your own library" };
      }

      const parsed = UserGameInsertSchema.safeParse(body);
      if (!parsed.success) {
        set.status = 400;
        return { error: parsed.error };
      }

      const { gameId, status, rating, review, platformId } = parsed.data;

      const existingGame = await db.query.userGames.findFirst({
        where: and(eq(userGames.userId, user.id), eq(userGames.gameId, gameId)),
      });

      if (existingGame) {
        set.status = 409;
        return { error: "Game already exists in library" };
      }

      const [inserted] = await db
        .insert(userGames)
        .values({
          userId: user.id,
          gameId,
          status,
          rating: rating?.toString(),
          review,
          platformId,
          source: "manual",
        })
        .returning();

      return {
        message: "Game added successfully",
        game: inserted,
      };
    } catch (error) {
      logger.exception(error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  },
  {
    auth: true,
    params: t.Object({
      username: t.String(),
    }),
    body: t.Object({
      gameId: t.Integer(),
      status: t.String({
        enum: [
          "finished",
          "playing",
          "dropped",
          "online",
          "want_to_play",
          "backlog",
        ],
      }),
      rating: t.Optional(t.Number()),
      review: t.Optional(t.String()),
      platformId: t.Optional(t.Integer()),
    }),
    detail: {
      tags: ["user"],
      summary: "Add a game to user's library",
      description:
        "Adds a game to the authenticated user's library. Username must match the authorized user.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Game added successfully",
          content: {
            "application/json": {
              schema: z.toJSONSchema(UserGameInsertSchema) as any,
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
        403: {
          description: "Forbidden — username mismatch",
          content: {
            "application/json": {
              schema: ForbiddenErrorResponseSchema,
            },
          },
        },
        409: {
          description: "Game already exists",
          content: {
            "application/json": {
              schema: ConflictErrorResponseSchema,
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
