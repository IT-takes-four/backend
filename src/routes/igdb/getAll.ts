import { Elysia } from "elysia";

import { getIGDBToken } from "../../utils/igdb/token";
import { transformIGDBResponse } from "./utils";
import type { IGDBGameResponse } from "./types";

const MAIN_GAME_TYPES = [0, 8, 9];

export const searchIGDB = async (
  query: string,
  showOnlyGames: boolean = true
) => {
  try {
    console.log("Searching IGDB for:", query, "showOnlyGames:", showOnlyGames);

    const accessToken = await getIGDBToken();

    const url = "https://api.igdb.com/v4/games";
    const headers = {
      "Client-ID": process.env.TWITCH_CLIENT_ID ?? "",
      Authorization: accessToken,
      "Content-Type": "text/plain",
    };

    let bodyQuery = `
      search "${query}";
      fields id, name, slug, created_at, genres.name, genres.slug, 
             platforms.name, platforms.slug, first_release_date, keywords.name,
             cover.url, cover.width, cover.height, screenshots.url, screenshots.width, screenshots.height,
             websites.type.id, websites.type.type, websites.url, websites.trusted, 
             game_modes.name, game_modes.slug, total_rating, similar_games, storyline, summary,
             involved_companies.company.name, involved_companies.company.slug,
             game_type.id, game_type.type;
    `;

    if (showOnlyGames) {
      bodyQuery += `where game_type = (${MAIN_GAME_TYPES.join(", ")});`;
    }

    bodyQuery += `limit 50;`;

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: bodyQuery,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as IGDBGameResponse[];
    return data.map(transformIGDBResponse);
  } catch (error) {
    console.error("IGDB search error:", error);
    return [];
  }
};

export const getAllIGDB = new Elysia().get("/search", async ({ query }) => {
  const searchQuery = query?.q as string;
  const showOnlyGames = query?.showOnlyGames !== "false";

  if (!searchQuery) {
    return { error: "Search query is required" };
  }

  const results = await searchIGDB(searchQuery, showOnlyGames);
  return results;
});
