import { z } from "zod";
import { GameResponseSchema } from "./game";

const statusEnum = z.enum([
  "finished",
  "playing",
  "dropped",
  "online",
  "want_to_play",
  "backlog",
]);

export const UserGamePatchResponseSchema = z.object({
  message: z.literal("Game updated successfully"),
  game: z.object({
    userId: z.number(),
    gameId: z.number(),
    status: z.string(),
    rating: z.string().nullable(),
    review: z.string().nullable(),
    platformId: z.number().nullable(),
    source: z.string(),
    addedAt: z.number().nullable(),
  }),
});

export const UserGamePostSchema = z.object({
  gameId: z.number(),
  status: statusEnum,
  rating: z.number().min(0).max(10),
  review: z.string().optional(),
  platformId: z.number(),
});

export const UserGameDataSchema = z.object({
  status: statusEnum,
  rating: z.string().nullable(),
  review: z.string().nullable().optional(),
  platformId: z.number().nullable(),
  addedAt: z.string().nullable(),
  source: z.enum(["steam", "gog", "manual"]).optional(),
});

export const UserGameWithUserDataSchema = GameResponseSchema.extend({
  userGameData: UserGameDataSchema,
});

export const UserGameResponseSchema = z.object({
  games: z.array(UserGameWithUserDataSchema),
  meta: z.object({
    total: z.number(),
  }),
});
