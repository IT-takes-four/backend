import { sleep } from "bun";
import { Redis } from "ioredis";
import { Database } from "bun:sqlite";

// Configuration
const BASE_URL = "http://localhost:3000";
const REQUESTS_PER_SECOND = parseInt(process.env.LOAD_TEST_RPS || "10000");
const TEST_DURATION_SECONDS = parseInt(process.env.LOAD_TEST_DURATION || "20");
const CONCURRENT_BATCHES = 100; // Number of concurrent batches to send
const REQUESTS_PER_BATCH = Math.ceil(REQUESTS_PER_SECOND / CONCURRENT_BATCHES);
const MONITOR_INTERVAL_MS = 1000; // How often to check Redis and SQLite stats
const VERBOSE = process.env.LOAD_TEST_VERBOSE === "true";

// Print configuration
console.log("\n--- Load Test Configuration ---");
console.log(`Requests per second: ${REQUESTS_PER_SECOND}`);
console.log(`Test duration: ${TEST_DURATION_SECONDS} seconds`);
console.log(`Concurrent batches: ${CONCURRENT_BATCHES}`);
console.log(`Requests per batch: ${REQUESTS_PER_BATCH}`);
console.log(`Monitoring interval: ${MONITOR_INTERVAL_MS}ms`);
console.log(`Verbose mode: ${VERBOSE ? "enabled" : "disabled"}`);
console.log("--------------------------------\n");

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";

// SQLite configuration
const SQLITE_DB_PATH = "./games.db";

// Game names to search for (to simulate different user queries)
const GAME_NAMES = [
  // Popular game titles
  "zelda",
  "mario",
  "pokemon",
  "final fantasy",
  "halo",
  "call of duty",
  "minecraft",
  "fortnite",
  "gta",
  "assassin's creed",
  "cyberpunk",
  "witcher",
  "skyrim",
  "doom",
  "fallout",
  "resident evil",
  "dark souls",
  "god of war",
  "horizon",
  "uncharted",

  // More specific game titles
  "breath of the wild",
  "tears of the kingdom",
  "elden ring",
  "red dead redemption",
  "mass effect",
  "bioshock",
  "half-life",
  "portal",
  "overwatch",
  "league of legends",
  "world of warcraft",
  "diablo",
  "starcraft",
  "counter-strike",
  "valorant",
  "apex legends",
  "destiny",
  "borderlands",
  "far cry",
  "metal gear solid",
  "persona",
  "final fantasy vii",
  "kingdom hearts",
  "street fighter",
  "mortal kombat",
  "tekken",
  "gran turismo",
  "forza horizon",
  "need for speed",
  "fifa",
  "madden",
  "nba 2k",

  // Game genres and categories
  "rpg",
  "fps",
  "mmorpg",
  "strategy",
  "simulation",
  "racing",
  "sports",
  "puzzle",
  "platformer",
  "adventure",
  "action",
  "horror",
  "survival",
  "battle royale",

  // Game studios and publishers
  "nintendo",
  "sony",
  "microsoft",
  "ubisoft",
  "ea",
  "activision",
  "blizzard",
  "rockstar",
  "bethesda",
  "square enix",
  "capcom",
  "konami",
  "sega",
  "bandai namco",
  "cd projekt",
  "from software",
  "naughty dog",
  "bioware",
  "valve",
  "epic games",

  // Partial and misspelled searches
  "zeld",
  "mario kar",
  "pokemn",
  "final fant",
  "hal",
  "call of dut",
  "minecraf",
  "fortnte",
  "gt",
  "assasin",

  // Random characters and short queries
  "a",
  "z",
  "the",
  "game",
  "new",
  "best",
  "top",
  "2023",
  "2024",
  "play",

  // Longer phrases
  "games like zelda",
  "best rpg games",
  "open world games",
  "multiplayer games",
  "games with good story",
  "games with great graphics",
  "indie games",
  "retro games",
  "classic games",
  "upcoming games",

  // Non-English searches
  "juegos",
  "spiele",
  "jeux",
  "giochi",
  "jogos",
  "ゲーム",
  "게임",
  "游戏",

  // Special characters and symbols
  "game!",
  "game?",
  "game+",
  "game-",
  "game_",
  "game&",

  // Newer popular games
  "baldur's gate 3",
  "hogwarts legacy",
  "starfield",
  "spider-man 2",
  "diablo iv",
  "alan wake 2",
  "armored core",
  "star wars jedi",
  "resident evil 4",
  "street fighter 6",
  "final fantasy xvi",
  "dead space",
  "hi-fi rush",
  "lies of p",
  "sea of stars",
  "dave the diver",
  "tears of the kingdom",
  "shadow gambit",
  "starfield",
  "armored core vi",

  // Classic games
  "pac-man",
  "tetris",
  "super mario bros",
  "space invaders",
  "donkey kong",
  "galaga",
  "frogger",
  "asteroids",
  "pong",
  "centipede",
];

// Stats tracking
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalResponseTime = 0;
let minResponseTime = Number.MAX_SAFE_INTEGER;
let maxResponseTime = 0;
let requestsPerSecondHistory: number[] = [];
let responseTimeHistory: number[] = [];

// Redis client
let redisClient: Redis;

// SQLite database
let db: Database;

// Function to make a single request
async function makeRequest(gameName: string): Promise<void> {
  const startTime = performance.now();
  try {
    const searchUrl = `${BASE_URL}/games/search?q=${encodeURIComponent(
      gameName
    )}`;
    const response = await fetch(searchUrl, {
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    totalResponseTime += responseTime;
    minResponseTime = Math.min(minResponseTime, responseTime);
    maxResponseTime = Math.max(maxResponseTime, responseTime);

    if (response.ok) {
      successfulRequests++;
    } else {
      failedRequests++;
      console.error(`Request failed with status: ${response.status}`);
    }
  } catch (error) {
    failedRequests++;
    // Only log detailed errors for the first few failures to avoid flooding the console
    if (failedRequests < 10) {
      console.error(`Request error: ${error}`);
    } else if (failedRequests % 100 === 0) {
      console.error(`${failedRequests} failed requests so far`);
    }
  } finally {
    totalRequests++;
  }
}

// Function to generate a random complex search query
function generateRandomQuery(): string {
  const randomType = Math.floor(Math.random() * 10); // 0-9

  if (randomType < 7) {
    // 70% chance: Use a predefined game name
    const randomIndex = Math.floor(Math.random() * GAME_NAMES.length);
    return GAME_NAMES[randomIndex];
  } else if (randomType === 7) {
    // 10% chance: Combine two game names
    const index1 = Math.floor(Math.random() * GAME_NAMES.length);
    const index2 = Math.floor(Math.random() * GAME_NAMES.length);
    return `${GAME_NAMES[index1]} ${GAME_NAMES[index2]}`;
  } else if (randomType === 8) {
    // 10% chance: Add a qualifier to a game name
    const qualifiers = [
      "best",
      "top",
      "new",
      "popular",
      "classic",
      "free",
      "online",
      "multiplayer",
      "2023",
      "2024",
    ];
    const gameIndex = Math.floor(Math.random() * GAME_NAMES.length);
    const qualifierIndex = Math.floor(Math.random() * qualifiers.length);
    return `${qualifiers[qualifierIndex]} ${GAME_NAMES[gameIndex]}`;
  } else {
    // 10% chance: Generate a completely random string
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789 ";
    let result = "";
    const length = Math.floor(Math.random() * 10) + 1; // 1-10 characters
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Function to send a batch of requests concurrently
async function sendBatch(batchSize: number): Promise<void> {
  const promises = [];

  for (let i = 0; i < batchSize; i++) {
    // Generate a random search query
    const searchQuery = generateRandomQuery();

    promises.push(makeRequest(searchQuery));
  }

  await Promise.all(promises);
}

// Function to initialize Redis client
function initRedis(): Redis {
  const client = new Redis(REDIS_URL, {
    password: REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000),
  });

  client.on("error", (err) => {
    console.error("Redis error:", err);
  });

  return client;
}

// Function to initialize SQLite database
function initSQLite(): Database {
  return new Database(SQLITE_DB_PATH, { readonly: true });
}

// Function to get Redis queue stats
async function getRedisQueueStats(): Promise<{
  queueLength: number;
  processingLength: number;
  searchLocks: number;
  searchCaches: number;
}> {
  try {
    // Check if Redis client is still connected
    if (!redisClient.status || redisClient.status !== "ready") {
      console.log("Redis connection lost, reconnecting...");
      try {
        await redisClient.quit();
      } catch (e) {
        // Ignore errors when quitting an already closed connection
      }
      redisClient = initRedis();
    }

    const queueLength = await redisClient.llen("queue:sqlite_write");
    const processingLength = await redisClient.llen(
      "queue:sqlite_write:processing"
    );

    // Get all keys for search locks
    const searchLocks = await redisClient.keys("search_processing:*");

    // Get all keys for search caches
    const searchCaches = await redisClient.keys("search:*");

    return {
      queueLength,
      processingLength,
      searchLocks: searchLocks.length,
      searchCaches: searchCaches.length,
    };
  } catch (error) {
    console.error("Error getting Redis stats:", error);
    return {
      queueLength: -1,
      processingLength: -1,
      searchLocks: -1,
      searchCaches: -1,
    };
  }
}

// Function to get SQLite stats
function getSQLiteStats(): Promise<{
  gameCount: number;
  coverCount: number;
  screenshotCount: number;
  platformCount: number;
  genreCount: number;
}> {
  try {
    // Try to run a simple query to check if the database is still usable
    try {
      db.query("SELECT 1").get();
    } catch (e) {
      // Database is closed or has an error, reinitialize it
      console.log("SQLite connection lost, reconnecting...");
      db = initSQLite();
    }

    const gameCount = db.query("SELECT COUNT(*) as count FROM game").get() as {
      count: number;
    };
    const coverCount = db
      .query("SELECT COUNT(*) as count FROM cover")
      .get() as { count: number };
    const screenshotCount = db
      .query("SELECT COUNT(*) as count FROM screenshot")
      .get() as { count: number };
    const platformCount = db
      .query("SELECT COUNT(*) as count FROM platform")
      .get() as { count: number };
    const genreCount = db
      .query("SELECT COUNT(*) as count FROM genre")
      .get() as { count: number };

    return Promise.resolve({
      gameCount: gameCount.count,
      coverCount: coverCount.count,
      screenshotCount: screenshotCount.count,
      platformCount: platformCount.count,
      genreCount: genreCount.count,
    });
  } catch (error) {
    console.error("Error getting SQLite stats:", error);
    return Promise.resolve({
      gameCount: -1,
      coverCount: -1,
      screenshotCount: -1,
      platformCount: -1,
      genreCount: -1,
    });
  }
}

// Function to monitor Redis and SQLite
async function startMonitoring(): Promise<any> {
  // Initialize clients
  redisClient = initRedis();
  db = initSQLite();

  // Get initial stats
  const initialRedisStats = await getRedisQueueStats();
  const initialSQLiteStats = await getSQLiteStats();

  console.log("\n--- Initial Stats ---");
  console.log("Redis Queue Length:", initialRedisStats.queueLength);
  console.log("Redis Processing Length:", initialRedisStats.processingLength);
  console.log("Redis Search Locks:", initialRedisStats.searchLocks);
  console.log("Redis Search Caches:", initialRedisStats.searchCaches);
  console.log("SQLite Game Count:", initialSQLiteStats.gameCount);
  console.log("SQLite Cover Count:", initialSQLiteStats.coverCount);
  console.log("SQLite Screenshot Count:", initialSQLiteStats.screenshotCount);
  console.log("SQLite Platform Count:", initialSQLiteStats.platformCount);
  console.log("SQLite Genre Count:", initialSQLiteStats.genreCount);

  // Start monitoring interval
  return setInterval(async () => {
    const redisStats = await getRedisQueueStats();
    const sqliteStats = await getSQLiteStats();

    console.log("\n--- Current Stats ---");
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Total Requests: ${totalRequests}`);
    console.log(
      `Requests/sec (last second): ${
        requestsPerSecondHistory[requestsPerSecondHistory.length - 1] || 0
      }`
    );
    console.log(
      `Avg Response Time (last second): ${
        responseTimeHistory[responseTimeHistory.length - 1]?.toFixed(2) || 0
      } ms`
    );
    console.log("Redis Queue Length:", redisStats.queueLength);
    console.log("Redis Processing Length:", redisStats.processingLength);
    console.log("Redis Search Locks:", redisStats.searchLocks);
    console.log("Redis Search Caches:", redisStats.searchCaches);
    console.log("SQLite Game Count:", sqliteStats.gameCount);
  }, MONITOR_INTERVAL_MS);
}

// Function to stop monitoring
async function stopMonitoring(intervalId: any): Promise<void> {
  clearInterval(intervalId);

  // Close connections
  if (redisClient) {
    await redisClient.quit();
  }

  if (db) {
    db.close();
  }
}

// Main function to run the load test
async function runLoadTest(): Promise<void> {
  console.log(
    `Starting load test: ${REQUESTS_PER_SECOND} requests/sec for ${TEST_DURATION_SECONDS} seconds`
  );
  console.log(
    `Total requests to be sent: ${REQUESTS_PER_SECOND * TEST_DURATION_SECONDS}`
  );

  // Start monitoring
  const monitoringInterval = await startMonitoring();

  const startTime = performance.now();
  let previousTotalRequests = 0;

  for (let second = 0; second < TEST_DURATION_SECONDS; second++) {
    const secondStartTime = performance.now();
    const requestsBeforeThisSecond = totalRequests;

    // Send batches concurrently
    const batchPromises = [];
    for (let batch = 0; batch < CONCURRENT_BATCHES; batch++) {
      batchPromises.push(sendBatch(REQUESTS_PER_BATCH));
    }

    await Promise.all(batchPromises);

    const secondEndTime = performance.now();
    const secondElapsed = secondEndTime - secondStartTime;

    // Calculate stats for this second
    const requestsThisSecond = totalRequests - requestsBeforeThisSecond;
    requestsPerSecondHistory.push(requestsThisSecond);

    // Calculate average response time for this second
    const avgResponseTimeThisSecond =
      (totalResponseTime - previousTotalRequests) / requestsThisSecond;
    responseTimeHistory.push(avgResponseTimeThisSecond);
    previousTotalRequests = totalResponseTime;

    // If we completed faster than 1 second, wait for the remainder
    if (secondElapsed < 1000) {
      await sleep(1000 - secondElapsed);
    }

    // Print progress
    console.log(
      `Second ${
        second + 1
      }/${TEST_DURATION_SECONDS} completed. Requests sent: ${totalRequests}`
    );
  }

  const endTime = performance.now();
  const totalTimeSeconds = (endTime - startTime) / 1000;

  // Stop monitoring
  await stopMonitoring(monitoringInterval);

  // Get final stats
  const finalRedisStats = await getRedisQueueStats();
  const finalSQLiteStats = await getSQLiteStats();

  // Print final stats
  console.log("\n--- Load Test Results ---");
  console.log(`Total time: ${totalTimeSeconds.toFixed(2)} seconds`);
  console.log(`Total requests: ${totalRequests}`);
  console.log(`Successful requests: ${successfulRequests}`);
  console.log(`Failed requests: ${failedRequests}`);
  console.log(
    `Requests per second: ${(totalRequests / totalTimeSeconds).toFixed(2)}`
  );
  console.log(
    `Average response time: ${(totalResponseTime / totalRequests).toFixed(
      2
    )} ms`
  );
  console.log(`Min response time: ${minResponseTime.toFixed(2)} ms`);
  console.log(`Max response time: ${maxResponseTime.toFixed(2)} ms`);

  console.log("\n--- Final Redis Stats ---");
  console.log("Redis Queue Length:", finalRedisStats.queueLength);
  console.log("Redis Processing Length:", finalRedisStats.processingLength);
  console.log("Redis Search Locks:", finalRedisStats.searchLocks);
  console.log("Redis Search Caches:", finalRedisStats.searchCaches);

  console.log("\n--- Final SQLite Stats ---");
  console.log("SQLite Game Count:", finalSQLiteStats.gameCount);
  console.log("SQLite Cover Count:", finalSQLiteStats.coverCount);
  console.log("SQLite Screenshot Count:", finalSQLiteStats.screenshotCount);
  console.log("SQLite Platform Count:", finalSQLiteStats.platformCount);
  console.log("SQLite Genre Count:", finalSQLiteStats.genreCount);
}

// Run the load test
runLoadTest().catch((error) => {
  console.error("Load test failed:", error);
  process.exit(1);
});
