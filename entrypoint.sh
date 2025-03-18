#!/bin/sh
# Print environment for debugging
echo "Current environment:"
echo "SQLITE_DATABASE_URL=$SQLITE_DATABASE_URL"
echo "Working directory: $(pwd)"
echo "Contents of /app directory:"
ls -la /app
echo "Contents of /app/data directory:"
ls -la /app/data || echo "/app/data directory not found"

# Use the database path from environment variable or default
DB_PATH=${SQLITE_DATABASE_URL:-"./games.db"}
echo "Using database path: $DB_PATH"
DB_FULL_PATH="/app/$DB_PATH"
echo "Full database path: $DB_FULL_PATH"

# Check if the database directory is empty
DB_JUST_CREATED=false
if [ ! -s "$DB_FULL_PATH" ]; then
  echo "No database found, will create a new one"
  mkdir -p $(dirname "$DB_FULL_PATH")
  touch "$DB_FULL_PATH"
  DB_JUST_CREATED=true
fi

# Always run migrations unless explicitly disabled
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running migrations..."
  # Run migrations and ensure it completes successfully
  if ! bun run db:migrate; then
    echo "Migration failed!"
    exit 1
  fi
  echo "Migrations completed successfully"
else
  echo "Skipping migrations"
fi

# Run seed if explicitly enabled OR if database was just created
if [ "$RUN_SEED" = "true" ] || [ "$DB_JUST_CREATED" = "true" ]; then
  echo "Running seed..."
  # Run seed and ensure it completes successfully
  if ! bun run db:seed; then
    echo "Seeding failed!"
    exit 1
  fi
  echo "Seeding completed successfully"
else
  echo "Skipping seed"
fi

echo "Starting application..."
exec bun run src/index.ts 