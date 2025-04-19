import { Elysia, t } from "elysia";
import { and, eq } from "drizzle-orm";
import zodToJsonSchema from "zod-to-json-schema";

import { db } from "@/db/postgres";
import { userGames } from "@/db/postgres/schema";
import { betterAuth } from "@/lib/betterAuth";
import { createLogger } from "@/utils/enhancedLogger";
import {
  BadRequestErrorResponseSchema,
  ForbiddenErrorResponseSchema,
  InternalServerErrorResponseSchema,
  NotFoundErrorResponseSchema,
} from "@/schemas/error";
import { UserGamePatchResponseSchema } from "@/schemas/userGame";

const logger = createLogger("user-update-game");

export const patchUserGame = new Elysia().use(betterAuth).patch(
  "/user/:username/games/:id",
  async ({ params, user, body, set }) => {
    try {
      if (params.username !== user.username) {
        set.status = 403;
        return { error: "You can only update your own library" };
      }

      const hasAnyField = Object.keys(body).length > 0;
      if (!hasAnyField) {
        set.status = 400;
        return { error: "At least one field must be provided" };
      }

      const gameId = Number(params.id);

      const existing = await db.query.userGames.findFirst({
        where: and(eq(userGames.userId, user.id), eq(userGames.gameId, gameId)),
      });

      if (!existing) {
        set.status = 404;
        return { error: "Game not found in user's library" };
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
      };

      const [updated] = await db
        .update(userGames)
        .set(updateValues)
        .where(and(eq(userGames.userId, user.id), eq(userGames.gameId, gameId)))
        .returning();

      return {
        message: "Game updated successfully",
        game: updated,
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
    body: t.Object({
      status: t.Optional(
        t.String({
          enum: [
            "finished",
            "playing",
            "dropped",
            "online",
            "want_to_play",
            "backlog",
          ],
        })
      ),
      rating: t.Optional(t.Number()),
      review: t.Optional(t.String()),
      platformId: t.Optional(t.Numeric()),
    }),
    detail: {
      tags: ["User"],
      summary: "Update a game in user's library",
      description:
        "Updates game status, rating, review or platform in the authenticated user's library. At least one field must be provided.",
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Game updated successfully",
          content: {
            "application/json": {
              schema: zodToJsonSchema(UserGamePatchResponseSchema) as any,
            },
          },
        },
        400: {
          description: "Invalid input or no fields provided",
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
        404: {
          description: "Game not found",
          content: {
            "application/json": {
              schema: NotFoundErrorResponseSchema,
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
