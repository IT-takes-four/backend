import { relations } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  index,
} from "drizzle-orm/sqlite-core";

import { getCurrentTimestamp } from "../../utils/time";

export enum GameTypeEnum {
  MAIN_GAME = 0,
  DLC = 1,
  EXPANSION = 2,
  BUNDLE = 3,
  STANDALONE_EXPANSION = 4,
  MOD = 5,
  EPISODE = 6,
  SEASON = 7,
  REMAKE = 8,
  REMASTER = 9,
  EXPANDED_GAME = 10,
  PORT = 11,
  FORK = 12,
  PACK = 13,
  UPDATE = 14,
}

export enum ImageSourceEnum {
  IGDB = "igdb",
  LOCAL = "local",
}

export const platform = sqliteTable("platform", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const platformIndex = index("idx_platform_slug").on(platform.slug);

export const genre = sqliteTable("genre", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const genreIndex = index("idx_genre_slug").on(genre.slug);

export const gameMode = sqliteTable("game_mode", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const gameModeIndex = index("idx_game_mode_slug").on(gameMode.slug);

export const type = sqliteTable("type", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull().unique(),
});

export const typeIndex = index("idx_type_type").on(type.type);

export const websiteType = sqliteTable("website_type", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull().unique(),
});

export const websiteTypeIndex = index("idx_website_type_type").on(
  websiteType.type
);

export const game = sqliteTable("game", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  summary: text("summary"),
  storyline: text("storyline"),
  firstReleaseDate: integer("first_release_date"),
  createdAt: integer("created_at").notNull().default(getCurrentTimestamp()),
  totalRating: real("total_rating"),
  involvedCompanies: text("involved_companies"),
  keywords: text("keywords"),
  updatedAt: integer("updated_at").notNull().default(getCurrentTimestamp()),
  isPopular: integer("is_popular", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const gameNameIndex = index("idx_game_name").on(game.name);
export const gameSlugIndex = index("idx_game_slug").on(game.slug);
export const gamePopularIndex = index("idx_game_popular").on(game.isPopular);
export const gameRatingIndex = index("idx_game_rating").on(game.totalRating);

// Cover table (one-to-one with games)
export const cover = sqliteTable("cover", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .unique()
    .references(() => game.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  source: text("source", { enum: ["igdb", "local"] })
    .notNull()
    .default(ImageSourceEnum.IGDB),
  width: integer("width"),
  height: integer("height"),
});

export const coverGameIdIndex = index("idx_cover_game_id").on(cover.gameId);

// Screenshot table (many-to-one with games)
export const screenshot = sqliteTable("screenshot", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "cascade" }),
  hash: text("hash").notNull(),
  source: text("source", { enum: ["igdb", "local"] })
    .notNull()
    .default(ImageSourceEnum.IGDB),
  width: integer("width"),
  height: integer("height"),
});

export const screenshotGameIdIndex = index("idx_screenshot_game_id").on(
  screenshot.gameId
);

// Website table (many-to-one with games)
export const website = sqliteTable("website", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: integer("game_id")
    .notNull()
    .references(() => game.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  trusted: integer("trusted", { mode: "boolean" }),
  typeId: integer("type_id").references(() => websiteType.id),
});

export const websiteGameIdIndex = index("idx_website_game_id").on(
  website.gameId
);
export const websiteTypeIdIndex = index("idx_website_type_id").on(
  website.typeId
);

// Similar game table (many-to-many with games)
export const gameToSimilarGame = sqliteTable(
  "game_to_similar_game",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    similarGameId: integer("similar_game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(getCurrentTimestamp()),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.similarGameId] })]
);

export const gameToSimilarGameGameIdIndex = index("idx_g2sg_game_id").on(
  gameToSimilarGame.gameId
);
export const gameToSimilarGameSimilarGameIdIndex = index(
  "idx_g2sg_similar_game_id"
).on(gameToSimilarGame.similarGameId);

// Game to platform table (many-to-many with games)
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

export const gameToPlatformGameIdIndex = index("idx_g2p_game_id").on(
  gameToPlatform.gameId
);
export const gameToPlatformPlatformIdIndex = index("idx_g2p_platform_id").on(
  gameToPlatform.platformId
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

export const gameToGenreGameIdIndex = index("idx_g2g_game_id").on(
  gameToGenre.gameId
);
export const gameToGenreGenreIdIndex = index("idx_g2g_genre_id").on(
  gameToGenre.genreId
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

export const gameToGameModeGameIdIndex = index("idx_g2gm_game_id").on(
  gameToGameMode.gameId
);
export const gameToGameModeGameModeIdIndex = index("idx_g2gm_game_mode_id").on(
  gameToGameMode.gameModeId
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

export const gameToTypeGameIdIndex = index("idx_g2t_game_id").on(
  gameToType.gameId
);
export const gameToTypeTypeIdIndex = index("idx_g2t_type_id").on(
  gameToType.typeId
);

export const gameRelations = relations(game, ({ many, one }) => ({
  platforms: many(gameToPlatform, { relationName: "game_platforms" }),
  genres: many(gameToGenre, { relationName: "game_genres" }),
  gameModes: many(gameToGameMode, { relationName: "game_modes" }),
  types: many(gameToType, { relationName: "game_types" }),
  similarGames: many(gameToSimilarGame, { relationName: "similar_games" }),
  cover: one(cover),
  screenshots: many(screenshot),
  websites: many(website),
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

export const gameToSimilarGameRelations = relations(
  gameToSimilarGame,
  ({ one }) => ({
    game: one(game, {
      fields: [gameToSimilarGame.gameId],
      references: [game.id],
      relationName: "similar_games",
    }),
    similarGame: one(game, {
      fields: [gameToSimilarGame.similarGameId],
      references: [game.id],
      relationName: "games_similar_to",
    }),
  })
);
