import { relations } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// Reference tables from IGDB
export const platform = sqliteTable("platform", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

export const genre = sqliteTable("genre", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

export const gameMode = sqliteTable("game_mode", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
});

export const type = sqliteTable("type", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
});

export const websiteType = sqliteTable("website_type", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
});

// Main game table
export const game = sqliteTable("game", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  summary: text("summary"),
  storyline: text("storyline"),
  firstReleaseDate: integer("first_release_date"),
  createdAt: integer("created_at")
    .notNull()
    .default(Math.floor(Date.now() / 1000)),
  totalRating: real("total_rating"),
  involvedCompanies: text("involved_companies"),
  keywords: text("keywords"),
  updatedAt: integer("updated_at")
    .notNull()
    .default(Math.floor(Date.now() / 1000)),
  isPopular: integer("is_popular", { mode: "boolean" })
    .notNull()
    .default(false),
});

// Covers table (one-to-one with games)
export const cover = sqliteTable("cover", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .unique()
    .references(() => game.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  width: integer("width"),
  height: integer("height"),
});

// Screenshots table (many-to-one with games)
export const screenshot = sqliteTable("screenshot", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  width: integer("width"),
  height: integer("height"),
});

// Websites table (many-to-one with games)
export const website = sqliteTable("website", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  trusted: integer("trusted", { mode: "boolean" }),
  typeId: integer("type_id").references(() => websiteType.id),
});

// Many-to-many relations
export const gameToSimilarGame = sqliteTable(
  "game_to_similar_game",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id),
    similarGameId: integer("similar_game_id")
      .notNull()
      .references(() => game.id),
    createdAt: integer("created_at")
      .notNull()
      .default(Math.floor(Date.now() / 1000)),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.similarGameId] })]
);

// Many-to-many relations
export const gameToPlatform = sqliteTable(
  "game_to_platform",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => platform.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.platformId] })]
);

export const gameToGenre = sqliteTable(
  "game_to_genre",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    genreId: integer("genre_id")
      .notNull()
      .references(() => genre.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.genreId] })]
);

export const gameToGameMode = sqliteTable(
  "game_to_game_mode",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    gameModeId: integer("game_mode_id")
      .notNull()
      .references(() => gameMode.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.gameModeId] })]
);

export const gameToType = sqliteTable(
  "game_to_type",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    typeId: integer("type_id")
      .notNull()
      .references(() => type.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.typeId] })]
);

// Relations
export const gameRelations = relations(game, ({ many, one }) => ({
  cover: one(cover),
  screenshots: many(screenshot),
  websites: many(website),
  platforms: many(gameToPlatform, { relationName: "game_platforms" }),
  genres: many(gameToGenre, { relationName: "game_genres" }),
  modes: many(gameToGameMode, { relationName: "game_modes" }),
  types: many(gameToType, { relationName: "game_types" }),
}));

export const coverRelations = relations(cover, ({ one }) => ({
  game: one(game, {
    fields: [cover.gameId],
    references: [game.id],
  }),
}));

export const screenshotRelations = relations(screenshot, ({ one }) => ({
  game: one(game, {
    fields: [screenshot.gameId],
    references: [game.id],
  }),
}));

export const websiteRelations = relations(website, ({ one }) => ({
  game: one(game, {
    fields: [website.gameId],
    references: [game.id],
  }),
  websiteType: one(websiteType, {
    fields: [website.typeId],
    references: [websiteType.id],
  }),
}));

export const platformRelations = relations(platform, ({ many }) => ({
  games: many(gameToPlatform, { relationName: "platform_games" }),
}));

export const genreRelations = relations(genre, ({ many }) => ({
  games: many(gameToGenre, { relationName: "genre_games" }),
}));

export const gameModeRelations = relations(gameMode, ({ many }) => ({
  games: many(gameToGameMode, { relationName: "game_mode_games" }),
}));

export const typeRelations = relations(type, ({ many }) => ({
  games: many(gameToType, { relationName: "type_games" }),
}));

export const websiteTypeRelations = relations(websiteType, ({ many }) => ({
  websites: many(website),
}));

export const gameToPlatformRelations = relations(gameToPlatform, ({ one }) => ({
  game: one(game, {
    fields: [gameToPlatform.gameId],
    references: [game.id],
    relationName: "game_platforms",
  }),
  platform: one(platform, {
    fields: [gameToPlatform.platformId],
    references: [platform.id],
    relationName: "platform_games",
  }),
}));

export const gameToGenreRelations = relations(gameToGenre, ({ one }) => ({
  game: one(game, {
    fields: [gameToGenre.gameId],
    references: [game.id],
    relationName: "game_genres",
  }),
  genre: one(genre, {
    fields: [gameToGenre.genreId],
    references: [genre.id],
    relationName: "genre_games",
  }),
}));

export const gameToGameModeRelations = relations(gameToGameMode, ({ one }) => ({
  game: one(game, {
    fields: [gameToGameMode.gameId],
    references: [game.id],
    relationName: "game_modes",
  }),
  gameMode: one(gameMode, {
    fields: [gameToGameMode.gameModeId],
    references: [gameMode.id],
    relationName: "game_mode_games",
  }),
}));

export const gameToTypeRelations = relations(gameToType, ({ one }) => ({
  game: one(game, {
    fields: [gameToType.gameId],
    references: [game.id],
    relationName: "game_types",
  }),
  type: one(type, {
    fields: [gameToType.typeId],
    references: [type.id],
    relationName: "type_games",
  }),
}));
