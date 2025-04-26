import { t } from "elysia";

export const GameCoverSchema = t.Object(
  {
    id: t.Numeric(),
    url: t.Nullable(t.String()),
    width: t.Optional(t.Numeric()),
    height: t.Optional(t.Numeric()),
  },
  { $id: "GameCover" }
);

export const GameScreenshotSchema = t.Object(
  {
    id: t.Numeric(),
    url: t.Nullable(t.String()),
    width: t.Optional(t.Numeric()),
    height: t.Optional(t.Numeric()),
  },
  { $id: "GameScreenshot" }
);

export const GameWebsiteSchema = t.Object(
  {
    id: t.Numeric(),
    url: t.String(),
    trusted: t.Optional(t.Boolean()),
    typeId: t.Optional(t.Numeric()),
  },
  { $id: "GameWebsite" }
);

export const GamePlatformSchema = t.Object(
  {
    id: t.Numeric(),
    name: t.String(),
    slug: t.String(),
  },
  { $id: "GamePlatform" }
);

export const GameGenreSchema = t.Object(
  {
    id: t.Numeric(),
    name: t.String(),
    slug: t.String(),
  },
  { $id: "GameGenre" }
);

export const GameTypeSchema = t.Object(
  {
    id: t.Numeric(),
    type: t.String(),
  },
  { $id: "GameType" }
);

export const GameSimilarGameSchema = t.Object(
  {
    id: t.Numeric(),
  },
  { $id: "GameSimilarGame" }
);

export const GameResponseSchema = t.Object(
  {
    id: t.Numeric(),
    name: t.String(),
    slug: t.String(),
    summary: t.Optional(t.String()),
    storyline: t.Optional(t.String()),
    firstReleaseDate: t.Optional(t.Numeric()),
    createdAt: t.Optional(t.Numeric()),
    totalRating: t.Optional(t.Numeric()),
    involvedCompanies: t.Optional(t.String()),
    keywords: t.Optional(t.String()),
    updatedAt: t.Optional(t.Numeric()),
    isPopular: t.Optional(t.Boolean()),
    cover: t.Ref("GameCover"),
    screenshots: t.Array(t.Ref("GameScreenshot")),
    websites: t.Array(t.Ref("GameWebsite")),
    platforms: t.Array(t.Ref("GamePlatform")),
    genres: t.Array(t.Ref("GameGenre")),
    types: t.Array(t.Ref("GameType")),
    similarGames: t.Array(t.Ref("GameSimilarGame")),
  },
  { $id: "GameResponse" }
);

export const MetaSchema = t.Object(
  {
    total: t.Numeric(),
    limit: t.Numeric(),
    offset: t.Numeric(),
  },
  { $id: "Meta" }
);

export const GameListResponseSchema = t.Object(
  {
    games: t.Array(t.Ref("GameResponse")),
    meta: t.Ref("Meta"),
  },
  { $id: "GameListResponse" }
);
