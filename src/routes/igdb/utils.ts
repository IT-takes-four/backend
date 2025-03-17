import { getIGDBToken } from "../../utils/igdb/token";
import { transformIGDBResponse } from "./transformers";
import type { IGDBGameResponse } from "./types";
import { createLogger } from "../../utils/enhancedLogger";
import { GameTypeEnum } from "../../db/schema";

const logger = createLogger("igdb");

const MAIN_GAME_TYPES = [
  GameTypeEnum.MAIN_GAME,
  GameTypeEnum.REMAKE,
  GameTypeEnum.REMASTER,
];

export const searchIGDB = async (
  query: string,
  showOnlyGames: boolean = true,
  limit: number = 50
) => {
  try {
    logger.info("Searching IGDB for:", { query, showOnlyGames });

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
             cover.image_id, cover.width, cover.height, 
             screenshots.image_id, screenshots.width, screenshots.height,
             websites.type.id, websites.type.type, websites.url, websites.trusted, 
             game_modes.name, game_modes.slug, total_rating, similar_games, storyline, summary,
             involved_companies.company.name, involved_companies.company.slug,
             game_type.id, game_type.type;
    `;

    if (showOnlyGames) {
      bodyQuery += `where game_type = (${MAIN_GAME_TYPES.join(", ")});`;
    }

    bodyQuery += `limit ${limit};`;

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: bodyQuery,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, response: ${errorText}`
      );
    }

    const data = (await response.json()) as IGDBGameResponse[];
    return data.map(transformIGDBResponse);
  } catch (error) {
    logger.exception(error, {
      context: "IGDB",
      operation: "searchIGDB",
      query,
      showOnlyGames,
      limit,
    });
    logger.error("IGDB search error:", { error });
    return [];
  }
};

export const fetchIGDBByIds = async (
  ids: number[],
  showOnlyGames: boolean = true
): Promise<IGDBGameResponse[]> => {
  try {
    if (!ids || ids.length === 0) return [];

    logger.info(`Fetching games from IGDB by IDs`, {
      count: ids.length,
      ids: ids.join(","),
    });

    const accessToken = await getIGDBToken();

    const url = "https://api.igdb.com/v4/games";
    const headers = {
      "Client-ID": process.env.TWITCH_CLIENT_ID ?? "",
      Authorization: accessToken,
      "Content-Type": "text/plain",
    };

    let bodyQuery = `
      fields id, name, slug, created_at, genres.name, genres.slug, 
             platforms.name, platforms.slug, first_release_date, keywords.name,
             cover.image_id, cover.width, cover.height, 
             screenshots.image_id, screenshots.width, screenshots.height,
             websites.type.id, websites.type.type, websites.url, websites.trusted, 
             game_modes.name, game_modes.slug, total_rating, similar_games, storyline, summary,
             involved_companies.company.name, involved_companies.company.slug,
             game_type.id, game_type.type;
      where id = (${ids.join(",")})
    `;

    if (showOnlyGames) {
      bodyQuery += ` & game_type = (${MAIN_GAME_TYPES.join(", ")})`;
    }

    bodyQuery += `;`;

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: bodyQuery,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, response: ${errorText}`
      );
    }

    const data = await response.json();
    return data as IGDBGameResponse[];
  } catch (error) {
    logger.exception(error, {
      context: "IGDB",
      operation: "fetchIGDBByIds",
      idsCount: ids?.length || 0,
      showOnlyGames,
    });
    logger.error("Error fetching games by IDs:", { error });
    return [];
  }
};
