FROM oven/bun:latest as base

WORKDIR /app

# Install dependencies
COPY package.json .
COPY bun.lock .
COPY tsconfig.json .
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ src/

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose the port
EXPOSE 3000

# Start the application
CMD ["bun", "run", "src/index.ts"] 