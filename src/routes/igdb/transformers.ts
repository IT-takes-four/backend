import type { IGDBGameResponse, IGDBWebsite } from "./types";

export const transformIGDBResponse = (game: IGDBGameResponse) => {
  const {
    cover,
    screenshots,
    first_release_date,
    created_at,
    websites,
    keywords,
    involved_companies,
    game_type,
    ...restGame
  } = game;

  return {
    ...restGame,
    first_release_date,
    created_at,
    cover: cover && {
      id: cover.id,
      hash: cover.image_id,
      width: cover.width,
      height: cover.height,
    },
    screenshots: screenshots?.map(({ id, image_id, width, height }) => ({
      id,
      hash: image_id,
      width,
      height,
    })),
    websites: websites?.map(({ id, type, url, trusted }) => ({
      id,
      type: typeof type === "object" ? type.type : type,
      url,
      trusted,
    })),
    keywords: keywords?.map((keyword) => keyword.name).join(", "),
    involved_companies: involved_companies
      ?.map((company) => company.company.name)
      .join(", "),
    game_types: game_type && [
      {
        id: game_type.id,
        type: game_type.type,
      },
    ],
    isPopular: false,
  };
};
