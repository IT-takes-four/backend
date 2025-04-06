import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userGames = pgTable("user_games", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  gameId: integer("game_id").notNull(),
  status: text("status", {
    enum: [
      "finished",
      "playing",
      "dropped",
      "online",
      "want_to_play",
      "backlog",
    ],
  }).notNull(),
  source: text("source", {
    enum: ["steam", "gog", "manual"],
  })
    .notNull()
    .default("manual"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const userFollows = pgTable("user_follows", {
  id: uuid("id").defaultRandom().primaryKey(),
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
