import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { createLogger } from "@/utils/enhancedLogger";
import { betterAuth } from "@/lib/betterAuth";

const logger = createLogger("user-remove-game");

const userGameDeleteSchema = z.object({
  gameId: z.number(),
});

export const removeGame = new Elysia().use(betterAuth).post(
  "/games",
  async ({ body, set, user }) => {
    try {
      const validatedBody = userGameDeleteSchema.safeParse(body);
      if (!validatedBody.success) {
        set.status = 400;
        return { error: validatedBody.error };
      }

      const { gameId } = validatedBody.data;

      const existingGame = await db.query.userGames.findFirst({
        where: (games, { and }) =>
          and(eq(games.userId, user.id), eq(games.gameId, gameId)),
      });

      if (existingGame) {
        set.status = 409;
        return { error: "Game already exists in library" };
      }

      const [newUserGame] = await db
        .delete(userGames)
        .where(eq(userGames.userId, user.id))
        .returning();

      return {
        message: "Game removed successfully",
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
    }),
    detail: {
      tags: ["user"],
      summary: "Remove a game from user's library",
      description: "Removes a game from the authenticated user's library",
      security: [{ bearerAuth: [] }],
    },
  }
);
