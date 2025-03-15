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

Open http://localhost:3000/ with your browser to see the result.

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
docker run -p 3000:3000 quokka-api
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
