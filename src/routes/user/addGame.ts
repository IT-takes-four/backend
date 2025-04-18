import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { createLogger } from "@/utils/enhancedLogger";
import { betterAuth } from "@/lib/betterAuth";

const logger = createLogger("user-add-game");

const userGameInsertSchema = z.object({
  gameId: z.number(),
  status: z.enum([
    "finished",
    "playing",
    "dropped",
    "online",
    "want_to_play",
    "backlog",
  ]),
  rating: z.number().min(0).max(10).optional(),
  review: z.string().optional(),
  platformId: z.number().optional(),
});

type UserGameInsert = typeof userGames.$inferInsert;

export const addGame = new Elysia().use(betterAuth).post(
  "/games",
  async ({ body, set, user }) => {
    try {
      const validatedBody = userGameInsertSchema.safeParse(body);
      if (!validatedBody.success) {
        set.status = 400;
        return { error: validatedBody.error };
      }

      const { gameId, status, rating, review, platformId } = validatedBody.data;

      const existingGame = await db.query.userGames.findFirst({
        where: (games, { and }) =>
          and(eq(games.userId, user.id), eq(games.gameId, gameId)),
      });

      if (existingGame) {
        set.status = 409;
        return { error: "Game already exists in library" };
      }

      const newGame: UserGameInsert = {
        userId: user.id,
        gameId,
        status,
        rating: rating?.toString(),
        review,
        platformId,
        source: "manual",
      };

      const [newUserGame] = await db
        .insert(userGames)
        .values(newGame)
        .returning();

      return {
        message: "Game added successfully",
        game: newUserGame,
      };
    } catch (error) {
      logger.exception(error);
      set.status = 500;
      return { error: "Internal server error" };
    }
  },
  {
    auth: true,
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
      description: "Adds a game to the authenticated user's library",
      security: [{ bearerAuth: [] }],
    },
  }
);
