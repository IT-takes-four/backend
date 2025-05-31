import { Elysia, t } from "elysia";
import { CoreMessage, streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";

import { searchGamesWithCache } from "@/utils/searchGames";
import { betterAuth } from "@/lib/betterAuth";

const searchGamesTool = tool({
  description: "Search for games by name or description",
  parameters: z.object({
    query: z.string().describe("The search query for finding games"),
    rating: z.number().min(0).max(10).optional(),
    status: z
      .enum(["finished", "playing", "dropped", "want_to_play"])
      .optional(),
    review: z.string().optional(),
    showOnlyGames: z.boolean().default(true),
  }),
  execute: async ({ query, rating, status, review, showOnlyGames }) => {
    const searchGames = await searchGamesWithCache(query);

    return {
      results: searchGames.results,
      userRating: rating,
      userStatus: status,
      userReview: review,
    };
  },
});

const systemPrompt = `You are a helpful gaming assistant that helps users track games they've played. 
When a user mentions a game they've played, use the search_games tool to find the game.
If the user mentions a rating (e.g., "I give it 8/10"), extract this as a number between 0-10 for the rating parameter.
If the user mentions a status (e.g., "finished", "playing", "dropped", "want to play"), extract this for the status parameter.
If the user provides any comments or review about the game, extract this for the review parameter.

Be conversational and friendly. If the user doesn't mention a specific game, just chat normally.`;

export const postAIChat = new Elysia().use(betterAuth).post(
  "/chat/ai",
  async ({ body, set }) => {
    try {
      const result = streamText({
        model: openai("gpt-4o"),
        system: systemPrompt,
        messages: body.messages as CoreMessage[],
        tools: {
          search_games: searchGamesTool,
        },
      });

      return result.toDataStreamResponse();
    } catch (error) {
      console.error("AI chat error:", error);
      set.status = 500;
      return {
        error: "Internal server error",
        message: "Something went wrong with the AI",
      };
    }
  },
  {
    auth: true,
    body: t.Object({
      messages: t.Array(
        t.Object({
          role: t.String({ enum: ["system", "user", "assistant", "tool"] }),
          content: t.Nullable(t.String()),
          name: t.Optional(t.String()),
        })
      ),
    }),
  }
);
