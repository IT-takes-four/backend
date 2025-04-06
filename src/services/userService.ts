import { eq } from "drizzle-orm";
import { UserJSON } from "@clerk/backend";

import { db } from "@/db/postgres";
import { users } from "@/db/postgres/schema";
import { millisecondToDate } from "@/utils/time";

export const createUser = async (userData: UserJSON): Promise<void> => {
  try {
    const createdAt = millisecondToDate(userData.created_at);
    const updatedAt = millisecondToDate(userData.updated_at);

    await db.insert(users).values({
      id: userData.id,
      createdAt: createdAt,
      updatedAt: updatedAt,
    });

    console.log(`Created user ${userData.id} in database`);
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
};

export const updateUser = async (userData: UserJSON): Promise<void> => {
  try {
    const updatedAt = millisecondToDate(userData.updated_at);

    await db
      .update(users)
      .set({
        updatedAt: updatedAt,
      })
      .where(eq(users.id, userData.id));

    console.log(`Updated user ${userData.id} in database`);
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    await db.delete(users).where(eq(users.id, userId));

    console.log(`Deleted user ${userId} from database`);
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
};

export const getUser = async (userId: string) => {
  try {
    const user = await db.select().from(users).where(eq(users.id, userId));
    return user[0] || null;
  } catch (error) {
    console.error("Error getting user:", error);
    throw error;
  }
};
