import { t } from "elysia";
import { GameResponseSchema } from "./game";

export const StatusEnumSchema = t.Union(
  [
    t.Literal("finished"),
    t.Literal("playing"),
    t.Literal("dropped"),
    t.Literal("online"),
    t.Literal("want_to_play"),
    t.Literal("backlog"),
  ],
  { $id: "StatusEnum" }
);

export const UserGamePatchResponseSchema = t.Object(
  {
    message: t.Literal("Game updated successfully"),
    game: t.Object({
      userId: t.Numeric(),
      gameId: t.Numeric(),
      status: t.String(),
      rating: t.Nullable(t.String()),
      review: t.Nullable(t.String()),
      platformId: t.Nullable(t.Numeric()),
      source: t.String(),
      addedAt: t.Nullable(t.Numeric()),
    }),
  },
  { $id: "UserGamePatchResponse" }
);

export const UserGamePostSchema = t.Object(
  {
    gameId: t.Numeric(),
    status: t.Ref("StatusEnum"),
    rating: t.Numeric(), // в оригинале был number от 0 до 10, но в t.Numeric валидация min/max пока вручную
    review: t.Optional(t.String()),
    platformId: t.Numeric(),
  },
  { $id: "UserGamePost" }
);

export const UserGameDataSchema = t.Object(
  {
    status: t.Ref("StatusEnum"),
    rating: t.Nullable(t.String()),
    review: t.Optional(t.Nullable(t.String())),
    platformId: t.Nullable(t.Numeric()),
    addedAt: t.Nullable(t.String()),
    source: t.Optional(
      t.Union([t.Literal("steam"), t.Literal("gog"), t.Literal("manual")])
    ),
  },
  { $id: "UserGameData" }
);

export const UserGameWithUserDataSchema = t.Intersect(
  [
    t.Ref("GameResponse"),
    t.Object({
      userGameData: t.Ref("UserGameData"),
    }),
  ],
  { $id: "UserGameWithUserData" }
);

export const UserGameResponseSchema = t.Object(
  {
    games: t.Array(t.Ref("UserGameWithUserData")),
    meta: t.Object({
      total: t.Numeric(),
    }),
  },
  { $id: "UserGameResponse" }
);
