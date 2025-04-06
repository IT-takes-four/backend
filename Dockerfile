FROM oven/bun:latest as base

WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .
COPY drizzle.sqlite.config.ts .
COPY drizzle.postgres.config.ts .
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/

# Create database directory
RUN mkdir -p data

# Set environment variables
ENV PORT=3030
ENV NODE_ENV=production
ENV SQLITE_DATABASE_URL=./games.db
ENV RUN_MIGRATIONS=true
ENV RUN_SEED=false

# Expose the port
EXPOSE 3030

# Copy the entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Set the entrypoint
ENTRYPOINT ["/app/entrypoint.sh"] 