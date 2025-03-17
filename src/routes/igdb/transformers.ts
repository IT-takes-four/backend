import type { IGDBGameResponse, IGDBWebsite } from "./types";

export const transformIGDBResponse = (game: IGDBGameResponse) => ({
  ...game,
  first_release_date: game.first_release_date,
  created_at: game.created_at,
  websites: game.websites?.map((website: IGDBWebsite) => ({
    id: website.id,
    type: typeof website.type === "object" ? website.type.type : website.type,
    url: website.url,
    trusted: website.trusted,
  })),
  keywords: game.keywords
    ? game.keywords.map((keyword) => keyword.name).join(", ")
    : undefined,
  involved_companies: game.involved_companies
    ? game.involved_companies.map((company) => company.company.name).join(", ")
    : undefined,
  game_types: game.game_type
    ? [
        {
          id: game.game_type.id,
          type: game.game_type.type,
        },
      ]
    : undefined,
  isPopular: false,
});
