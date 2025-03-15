FROM oven/bun:latest as base

WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .
COPY drizzle.config.ts .
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/

# Create database directory
RUN mkdir -p data

# Copy database file if it exists
COPY games.db ./data/games.db

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production
ENV DATABASE_URL=./data/games.db

# Expose the port
EXPOSE 3000

# Create a script to check if the database exists and run migrations if needed
RUN echo '#!/bin/sh\n\
    if [ -s /app/data/games.db ]; then\n\
    echo "Database already exists, skipping migrations"\n\
    else\n\
    echo "Running migrations..."\n\
    bun run db:migrate\n\
    fi\n\
    \n\
    echo "Starting application..."\n\
    bun run src/index.ts\n\
    ' > /app/start.sh && chmod +x /app/start.sh

# Set up the database and start the application
CMD ["/app/start.sh"] 