import { Elysia } from "elysia";
import {
  db,
  game,
  platform,
  genre,
  gameMode,
  type as gameType,
  websiteType,
  cover,
  screenshot,
  website,
} from "./db";
import { eq } from "drizzle-orm";

const app = new Elysia()
  .get("/", () => "Hello Elysia")

  // Games endpoints
  .get("/games", async () => {
    return await db.select().from(game).limit(100);
  })
  .get("/games/:id", async ({ params }) => {
    const { id } = params;
    const gameData = await db
      .select()
      .from(game)
      .where(eq(game.id, parseInt(id)))
      .limit(1);

    if (gameData.length === 0) {
      return { error: "Game not found" };
    }

    // Get cover
    const coverData = await db
      .select()
      .from(cover)
      .where(eq(cover.gameId, parseInt(id)));

    // Get screenshots
    const screenshotData = await db
      .select()
      .from(screenshot)
      .where(eq(screenshot.gameId, parseInt(id)));

    // Get websites
    const websiteData = await db
      .select()
      .from(website)
      .where(eq(website.gameId, parseInt(id)));

    return {
      ...gameData[0],
      cover: coverData[0] || null,
      screenshots: screenshotData,
      websites: websiteData,
    };
  })

  // Platforms endpoints
  .get("/platforms", async () => {
    return await db.select().from(platform);
  })
  .get("/platforms/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(platform)
      .where(eq(platform.id, parseInt(id)))
      .limit(1);
  })

  // Genres endpoints
  .get("/genres", async () => {
    return await db.select().from(genre);
  })
  .get("/genres/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(genre)
      .where(eq(genre.id, parseInt(id)))
      .limit(1);
  })

  // Game modes endpoints
  .get("/game-modes", async () => {
    return await db.select().from(gameMode);
  })
  .get("/game-modes/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(gameMode)
      .where(eq(gameMode.id, parseInt(id)))
      .limit(1);
  })

  // Game types endpoints
  .get("/types", async () => {
    return await db.select().from(gameType);
  })
  .get("/types/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(gameType)
      .where(eq(gameType.id, parseInt(id)))
      .limit(1);
  })

  // Website types endpoints
  .get("/website-types", async () => {
    return await db.select().from(websiteType);
  })
  .get("/website-types/:id", async ({ params }) => {
    const { id } = params;
    return await db
      .select()
      .from(websiteType)
      .where(eq(websiteType.id, parseInt(id)))
      .limit(1);
  })

  .listen(3000);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
