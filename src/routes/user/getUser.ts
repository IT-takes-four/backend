import { Elysia, t } from "elysia";
import { betterAuth } from "@/lib/betterAuth";
import { db as postgresDb } from "@/db/postgres";
import { user } from "@/db/postgres/schema";
import { eq } from "drizzle-orm";

export const getUser = new Elysia().use(betterAuth).get(
  "/:username",
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
      description: "Get a user info by username",
    },
  }
);
