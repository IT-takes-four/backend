import { db } from "@/db/sqlite";
import { getImageUrl, IgdbImageSize } from "@/utils/image";

export type GameWithRelations = Awaited<
  ReturnType<
    typeof db.query.game.findFirst<{
      with: {
        platforms: { with: { platform: true } };
        genres: { with: { genre: true } };
        types: { with: { type: true } };
        cover: true;
        screenshots: true;
        websites: true;
        similarGames?: { with: { similarGame: true } };
      };
    }>
  >
>;

export const transformGameResponse = (game: GameWithRelations) => ({
  ...game,
  platforms: game?.platforms?.map((platform) => platform.platform) || [],
  genres: game?.genres?.map((genre) => genre.genre) || [],
  types: game?.types?.map((type) => type.type) || [],
  cover: {
    id: game?.cover?.id,
    url: game?.cover?.hash
      ? getImageUrl(game.cover.source, game.cover.hash, IgdbImageSize.COVER_BIG)
      : null,
    width: game?.cover?.width,
    height: game?.cover?.height,
  },
  screenshots: game?.screenshots?.map((screenshot) => ({
    id: screenshot.id,
    url: screenshot.hash
      ? getImageUrl(
          screenshot.source,
          screenshot.hash,
          IgdbImageSize.SCREENSHOT_BIG
        )
      : null,
    width: screenshot.width,
    height: screenshot.height,
  })),
  websites: game?.websites?.map((website) => website) || [],
  similarGames:
    game?.similarGames?.map((relation) => ({
      id: relation.similarGameId,
    })) || [],
});
