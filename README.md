# Quokka API - Elysia with Bun runtime

## Getting Started

To get started with this template, simply paste this command into your terminal:

```bash
bun create elysia ./elysia-example
```

## Development

To start the development server run:

```bash
bun run dev
```

Open http://localhost:3030/ with your browser to see the result.

## Database

This project uses Drizzle ORM with Bun's native SQLite support.

### Database Setup

```bash
# Generate migrations
npm run db:generate

# Apply migrations
npm run db:migrate

# Seed the database with initial data (only needed once)
npm run db:seed

# Open Drizzle Studio to view and edit data
npm run db:studio
```

### API Endpoints

#### Games

- `GET /games` - Get all games
- `GET /games/:id` - Get a specific game with its cover, screenshots, and websites
- `GET /games/search` - Search for games by name with caching support

#### Search Endpoint

The search endpoint provides a powerful way to find games with caching and pagination:

```
GET /games/search?q=SEARCH_TERM
```

##### Parameters

- `q` (required): The search term to look for in game names
- `limit` (optional): Maximum number of results to return (default: 50)
- `offset` (optional): Number of results to skip for pagination (default: 0)
- `fresh` (optional): Set to "true" or "1" to bypass cache and get fresh results

##### Search Behavior

- Searches are case-insensitive
- Exact matches (including special characters) are prioritized in results
- If insufficient exact matches are found, the search automatically expands to include results without special characters
- For example, searching for "Pandemonium!" will first show exact matches, then other "Pandemonium" games
- This provides both precision for exact searches and more inclusive results when needed

##### Caching Behavior

- Results are cached for 24 hours
- Each unique combination of search term, limit, and offset has its own cache entry
- Concurrent identical searches are deduplicated to reduce external API calls

##### Example Requests

Basic search:

```
GET /games/search?q=Zelda
```

Pagination:

```
GET /games/search?q=Mario&limit=10&offset=0  // First 10 results
GET /games/search?q=Mario&limit=10&offset=10 // Next 10 results
```

Force fresh results (bypass cache):

```
GET /games/search?q=Pokemon&fresh=true
```

#### Platforms

- `GET /platforms` - Get all platforms
- `GET /platforms/:id` - Get a specific platform

#### Genres

- `GET /genres` - Get all genres
- `GET /genres/:id` - Get a specific genre

#### Game Modes

- `GET /game-modes` - Get all game modes
- `GET /game-modes/:id` - Get a specific game mode

#### Game Types

- `GET /types` - Get all game types
- `GET /types/:id` - Get a specific game type

#### Website Types

- `GET /website-types` - Get all website types
- `GET /website-types/:id` - Get a specific website type

## Production

To run the application in production mode:

```bash
bun run start
```

## Docker

This project includes Docker support for containerization.

### Database in Docker

The `games.db` SQLite database file is copied into the Docker image during the build process. Any changes made to the database while the container is running will be persisted in a Docker volume.

#### Database Management in Docker

Backup the database from a running container:

```bash
npm run docker:db:backup
# This creates a games.db.backup file in your project root
```

Restore a database backup to a running container:

```bash
npm run docker:db:restore
# This copies games.db.backup to the container
```

### Building the Docker image

```bash
npm run docker:build
# or directly with Docker
docker build -t quokka-api .
```

### Running the Docker container

```bash
npm run docker:run
# or directly with Docker
docker run -p 3030:3030 quokka-api
```

### Using Docker Compose

This project includes Docker Compose for easier container management.

Start the application with Docker Compose:

```bash
npm run docker:compose
# or directly with Docker Compose
docker-compose up
```

Build and start the application:

```bash
npm run docker:compose:build
# or directly with Docker Compose
docker-compose up --build
```

Stop the application:

```bash
npm run docker:compose:down
# or directly with Docker Compose
docker-compose down
```

Seed the database (only needed once):

```bash
npm run docker:compose:seed
# or directly with Docker Compose
docker-compose --profile seed run seed
```

### Pushing to a container registry

First, tag your image with your registry information:

```bash
docker tag quokka-api username/quokka-api:latest
```

Then push it:

```bash
npm run docker:push
# or directly with Docker
docker push username/quokka-api:latest
```

## Using the Docker Image

### From GitHub Container Registry

The application is available as a Docker image from GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/OWNER/quokka-api:latest

# Run the container
docker run -p 3030:3030 ghcr.io/OWNER/quokka-api:latest
```

Replace `OWNER` with your GitHub username or organization.

You can also specify a specific version tag instead of `latest`.

### Using Docker Compose with the GitHub Container Registry image

```yaml
version: "3"
services:
  api:
    image: ghcr.io/OWNER/quokka-api:latest
    ports:
      - "3030:3030"
    environment:
      - NODE_ENV=production
    volumes:
      - ./data:/app/data
```

## Database Management

### Migrations and Seeding

The application is configured to handle your SQLite database intelligently:

```bash
# Normal startup (runs migrations, doesn't seed unless database is new)
docker-compose up -d

# Run with explicit seeding (even if database already exists)
RUN_SEED=true docker-compose up -d

# Run without migrations (if you want to skip them)
RUN_MIGRATIONS=false docker-compose up -d
```

When you pull updates from the GitHub Container Registry, your database will be preserved because:

1. The database file is stored in a volume outside the container
2. Migrations run automatically but don't destroy existing data
3. Seeding automatically runs on a fresh database or when explicitly requested via the RUN_SEED environment variable

### Environment Variables for Database Control

You can control database behavior with these environment variables:

- `RUN_MIGRATIONS=true|false` - Control whether migrations run at startup (default: true)
- `RUN_SEED=true|false` - Control whether seeding runs on existing databases (default: false, but always runs on new databases)

Example using the GitHub Container Registry image:

```bash
# Pull and run with automatic migrations (default)
# Note: Will automatically seed if the database doesn't exist yet
docker run -p 3030:3030 -v ./data:/app/data ghcr.io/username/quokka-api:latest

# Pull and run with explicit seeding (even on existing databases)
docker run -p 3030:3030 -v ./data:/app/data -e RUN_SEED=true ghcr.io/username/quokka-api:latest
```

## Deployment

After pushing your Docker image to a container registry, you can deploy it to various platforms:

- AWS ECS/EKS
- Google Cloud Run/GKE
- Azure Container Instances/AKS
- Heroku
- Digital Ocean App Platform
- Railway
- Fly.io
- And many others that support Docker containers
