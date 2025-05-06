import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { createLogger } from "@/utils/enhancedLogger";
import { betterAuth } from "@/lib/betterAuth";

const logger = createLogger("user-remove-game");

export const deleteUserGame = new Elysia().use(betterAuth).delete(
  "/user/:username/games/:id",
  async ({ params, set, user }) => {
    try {
      const gameId = Number(params.id);

      const existingGame = await db.query.userGames.findFirst({
        where: (games, { and }) =>
          and(eq(games.userId, user.id), eq(games.gameId, gameId)),
      });

      if (!existingGame) {
        set.status = 404;
        return { error: "Game not found in user's library" };
      }

      const [deletedGame] = await db
        .delete(userGames)
        .where(and(eq(userGames.userId, user.id), eq(userGames.gameId, gameId)))
        .returning();

      return {
        message: "Game removed successfully",
        id: deletedGame.gameId,
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
      id: t.Numeric(),
    }),
  }
);
