import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import { user } from "@/db/postgres/schema";

export const getUser = new Elysia().get(
  "/user/:username",
  async ({ params, set }) => {
    const { username } = params;

    const data = await postgresDb.query.user.findFirst({
      where: eq(user.username, username),
    });

    if (!data) {
      set.status = 404;
      return {
        error: "User not found",
      };
    }

    return {
      id: data.id,
      image: data.image,
      name: data.name,
      username: data.username,
      games: [],
    };
  },
  {
    params: t.Object({
      username: t.String(),
    }),
    detail: {
      tags: ["user"],
      summary: "Get a user by username",
      description: "Returns public info about a user, by their username",
      responses: {
        200: {
          description: "User found",
        },
        404: {
          description: "User not found",
        },
      },
    },
  }
);
