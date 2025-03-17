import { db } from "../../db";

export type GameWithRelations = Awaited<
  ReturnType<
    typeof db.query.game.findFirst<{
      with: {
        platforms: { with: { platform: true } };
        genres: { with: { genre: true } };
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
  cover: {
    id: game?.cover?.id,
    url: game?.cover?.url,
    width: game?.cover?.width,
    height: game?.cover?.height,
  },
  screenshots: game?.screenshots?.map((screenshot) => ({
    id: screenshot.id,
    url: screenshot.url,
    width: screenshot.width,
    height: screenshot.height,
  })),
  websites: game?.websites?.map((website) => website) || [],
  similarGames:
    game?.similarGames?.map((relation) => ({
      id: relation.similarGameId,
    })) || [],
});
