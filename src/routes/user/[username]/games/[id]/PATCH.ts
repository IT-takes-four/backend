import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { betterAuth } from "@/lib/betterAuth";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("user-update-game");

export const patchUserGame = new Elysia().use(betterAuth).patch(
  "/user/:username/games/:id",
  async ({ params, user, body, set }) => {
    try {
      if (params.username !== user.username) {
        set.status = 403;
        return {
          error: "Forbidden",
          message: "You can only update your own library",
        };
      }

      const hasAnyField = Object.keys(body).length > 0;
      if (!hasAnyField) {
        set.status = 400;
        return {
          error: "Bad request",
          message: "At least one field must be provided",
        };
      }

      const gameId = Number(params.id);

      const existing = await db.query.userGames.findFirst({
        where: and(eq(userGames.userId, user.id), eq(userGames.gameId, gameId)),
      });

      if (!existing) {
        set.status = 404;
        return {
          error: "Not found",
          message: "Game not found in user's library",
        };
      }

      const updateValues = {
        ...(body.status && {
          status:
            body.status as (typeof userGames.status)["enumValues"][number],
        }),
        ...(body.rating !== undefined && {
          rating: body.rating.toString(),
        }),
        ...(body.review !== undefined && { review: body.review }),
        ...(body.platformId !== undefined && {
          platformId: body.platformId,
        }),
        ...(body.endedAt !== undefined && {
          endedAt: body.endedAt ? new Date(body.endedAt) : null,
        }),
      };

      const [updated] = await db
        .update(userGames)
        .set(updateValues)
        .where(and(eq(userGames.userId, user.id), eq(userGames.gameId, gameId)))
        .returning();

      return {
        message: "Game updated successfully",
        game: {
          ...updated,
          rating: updated.rating ? Number(updated.rating) : null,
        },
      };
    } catch (error) {
      logger.exception(error);
      set.status = 500;
      return {
        error: "Internal server error",
        message: "Failed to update game",
      };
    }
  },
  {
    auth: true,
    params: t.Object({
      username: t.String(),
      id: t.Numeric(),
    }),
    body: t.Object({
      status: t.Optional(
        t.String({
          enum: [
            "finished",
            "playing",
            "dropped",
            "online",
            "on_hold",
            "want_to_play",
            "backlog",
          ],
        })
      ),
      rating: t.Optional(t.Number()),
      review: t.Optional(t.String()),
      platformId: t.Optional(t.Numeric()),
      endedAt: t.Optional(
        t.String({
          transform: (value: string) => {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
              throw new Error("Invalid date format");
            }
            if (date > new Date()) {
              throw new Error("Finished date cannot be in the future");
            }
            return value;
          },
        })
      ),
    }),
  }
);
