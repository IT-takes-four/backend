import { z } from "zod";

export const GameCoverSchema = z.object({
  id: z.number(),
  url: z.string().nullable(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const GameScreenshotSchema = z.object({
  id: z.number(),
  url: z.string().nullable(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const GameWebsiteSchema = z.object({
  id: z.number(),
  url: z.string(),
  trusted: z.boolean().optional(),
  typeId: z.number().optional(),
});

export const GamePlatformSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const GameGenreSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export const GameTypeSchema = z.object({
  id: z.number(),
  type: z.string(),
});

export const GameSimilarGameSchema = z.object({
  id: z.number(),
});

export const GameResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  summary: z.string().optional(),
  storyline: z.string().optional(),
  firstReleaseDate: z.number().optional(),
  createdAt: z.number().optional(),
  totalRating: z.number().optional(),
  involvedCompanies: z.string().optional(),
  keywords: z.string().optional(),
  updatedAt: z.number().optional(),
  isPopular: z.boolean().optional(),
  cover: GameCoverSchema,
  screenshots: z.array(GameScreenshotSchema),
  websites: z.array(GameWebsiteSchema),
  platforms: z.array(GamePlatformSchema),
  genres: z.array(GameGenreSchema),
  types: z.array(GameTypeSchema),
  similarGames: z.array(GameSimilarGameSchema),
});
