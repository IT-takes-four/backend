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

## Production

To run the application in production mode:

```bash
bun run start
```

## Docker

This project includes Docker support for containerization.

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
