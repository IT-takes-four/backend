import { Elysia } from "elysia";
import { eq } from "drizzle-orm";

import { betterAuth } from "@/lib/betterAuth";
import { db } from "@/db/postgres";
import { user } from "@/db/postgres/schema";

export const getMe = new Elysia().use(betterAuth).get(
  "/me",
  async ({ user: authUser, set }) => {
    try {
      const userData = await db.query.user.findFirst({
        where: eq(user.id, authUser.id),
      });

      if (!userData) {
        set.status = 404;
        return { error: "Not found", message: "User not found" };
      }

      return {
        id: userData.id,
        username: userData.username,
        email: userData.email,
        name: userData.name,
        image: userData.image,
      };
    } catch (err) {
      console.error("Error fetching current user:", err);
      set.status = 500;
      return {
        error: "Internal server error",
        message: "Failed to fetch user data",
      };
    }
  },
  {
    auth: true,
  }
);
