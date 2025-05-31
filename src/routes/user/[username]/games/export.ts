import { Elysia, t } from "elysia";
import { eq } from "drizzle-orm";

import { db as postgresDb } from "@/db/postgres";
import { db as sqliteDb } from "@/db/sqlite";
import { userGames, user as userSchema } from "@/db/postgres/schema";
import { betterAuth } from "@/lib/betterAuth";
import { createLogger } from "@/utils/enhancedLogger";

const logger = createLogger("user-export-games");

function convertToCSV(games: any[]): string {
  if (games.length === 0) {
    return "gameId,gameName,status,rating,review,platformId,platformName,addedAt,endedAt,source\n";
  }

  const headers =
    "gameId,gameName,status,rating,review,platformId,platformName,addedAt,endedAt,source\n";

  const rows = games.map((game) => {
    const escapeCsvField = (field: any): string => {
      if (field === null || field === undefined) return "";
      const str = String(field);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (
        str.includes('"') ||
        str.includes(",") ||
        str.includes("\n") ||
        str.includes("\r")
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    return [
      game.gameId,
      escapeCsvField(game.gameName),
      escapeCsvField(game.status),
      game.rating || "",
      escapeCsvField(game.review),
      game.platformId,
      escapeCsvField(game.platformName),
      game.addedAt || "",
      game.endedAt || "",
      escapeCsvField(game.source),
    ].join(",");
  });

  return headers + rows.join("\n");
}

export const exportUserGames = new Elysia().use(betterAuth).get(
  "/user/:username/games/export",
  async ({ params, user, query, set }) => {
    try {
      const { username } = params;
      const { format = "json", download = "true" } = query;

      if (username !== user.username) {
        set.status = 403;
        return {
          error: "Forbidden",
          message: "You can only export your own game library",
        };
      }

      const userData = await postgresDb.query.user.findFirst({
        where: eq(userSchema.username, username),
      });

      if (!userData) {
        set.status = 404;
        return { error: "Not found", message: "User not found" };
      }

      const userGamesList = await postgresDb.query.userGames.findMany({
        where: eq(userGames.userId, userData.id),
      });

      const gameIds = userGamesList.map((ug) => ug.gameId);

      let gamesData: any[] = [];

      if (gameIds.length > 0) {
        const games = await sqliteDb.query.game.findMany({
          where: (game, { inArray }) => inArray(game.id, gameIds),
          with: {
            platforms: { with: { platform: true } },
          },
        });

        gamesData = games.map((game) => {
          const userGame = userGamesList.find((ug) => ug.gameId === game.id);
          const platform = game.platforms?.[0]?.platform;

          // Only include endedAt for finished or dropped games
          const shouldIncludeEndedAt =
            userGame?.status &&
            ["finished", "dropped"].includes(userGame.status);
          const endedAtValue = shouldIncludeEndedAt
            ? userGame?.endedAt?.toISOString()
            : null;

          return {
            gameId: game.id,
            gameName: game.name,
            status: userGame?.status,
            rating: userGame?.rating ? Number(userGame.rating) : null,
            review: userGame?.review,
            platformId: userGame?.platformId || 0,
            platformName: platform?.name || null,
            addedAt: userGame?.addedAt?.toISOString(),
            endedAt: endedAtValue,
            source: userGame?.source,
          };
        });
      }

      const exportedAt = new Date().toISOString();
      const shouldDownload = download === "true";

      if (format === "csv") {
        const csvContent = convertToCSV(gamesData);

        if (shouldDownload) {
          const filename = `games-export-${username}-${new Date().toISOString().split("T")[0]}.csv`;
          set.headers = {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`,
          };
        } else {
          set.headers = {
            "Content-Type": "text/csv",
          };
        }

        return csvContent;
      } else {
        const jsonResponse = {
          username,
          exportedAt,
          totalGames: gamesData.length,
          games: gamesData,
        };

        if (shouldDownload) {
          const filename = `games-export-${username}-${new Date().toISOString().split("T")[0]}.json`;
          set.headers = {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${filename}"`,
          };
        } else {
          set.headers = {
            "Content-Type": "application/json",
          };
        }

        return jsonResponse;
      }
    } catch (error) {
      logger.exception(error);
      set.status = 500;
      return {
        error: "Internal server error",
        message: "Failed to export games",
      };
    }
  },
  {
    auth: true,
    params: t.Object({
      username: t.String(),
    }),
    query: t.Object({
      format: t.Optional(t.Union([t.Literal("json"), t.Literal("csv")])),
      download: t.Optional(t.String()),
    }),
  }
);
