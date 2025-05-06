import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { betterAuth } from "@/lib/betterAuth";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("user-add-game");

export const postUserGame = new Elysia().use(betterAuth).post(
  "/user/:username/games",
  async ({ params, user, body, set }) => {
    try {
      if (params.username !== user.username) {
        set.status = 403;
        return { error: "You can only add games to your own library" };
      }

      const existingGame = await db.query.userGames.findFirst({
        where: and(
          eq(userGames.userId, user.id),
          eq(userGames.gameId, body.gameId)
        ),
      });

      if (existingGame) {
        set.status = 409;
        return { error: "Game already exists in library" };
      }

      const [inserted] = await db
        .insert(userGames)
        .values({
          userId: user.id,
          gameId: body.gameId,
          status:
            body.status as (typeof userGames.status)["enumValues"][number],
          rating: body.rating?.toString(),
          review: body.review,
          endedAt: body.endedAt ? new Date(body.endedAt) : null,
          platformId: body.platformId,
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
    body: t.Object(
      {
        gameId: t.Numeric({
          error: "Game ID must be a valid number",
        }),
        status: t.String({
          enum: userGames.status.enumValues,
        }),
        rating: t.Numeric({
          minimum: 0,
          maximum: 10,
          error: "Rating must be between 0 and 10",
        }),
        review: t.Optional(
          t.String({
            minLength: 3,
            maxLength: 5000,
            error: "Review must be between 3 and 5000 characters",
          })
        ),
        platformId: t.Numeric({
          error: "Platform ID must be a valid number",
        }),
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
      },
      {
        error: (input: { value: Record<string, any> }) => {
          if (
            (input.value.status === "finished" ||
              input.value.status === "dropped") &&
            !input.value.endedAt
          ) {
            return "Date is required when status is 'finished' or 'dropped'";
          }
        },
      }
    ),
  }
);
