import { z } from "zod";
import { GameResponseSchema } from "./game";

export const ChatRoleSchema = z.enum([
  "user",
  "assistant",
  "system",
  "function",
]);

const BaseMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().nullable(),
});

const FunctionMessageSchema = z.object({
  role: z.literal("function"),
  name: z.string(),
  content: z.string().nullable(),
});

export const MessageSchema = z.union([
  BaseMessageSchema,
  FunctionMessageSchema,
]);

export const OpenAIChatRequestSchema = z.object({
  messages: z.array(MessageSchema),
  showOnlyGames: z.boolean().optional().default(true),
});

export const OpenAIChatResponseSchema = z.object({
  message: z.object({
    role: z.literal("assistant"),
    content: z.string(),
    gameData: GameResponseSchema,
    gameResults: z.array(GameResponseSchema).optional(),
    userRating: z.number().optional(),
    userStatus: z.string().optional(),
    userReview: z.string().optional(),
  }),
});
