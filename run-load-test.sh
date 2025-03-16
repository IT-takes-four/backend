#!/bin/bash

# Default values
REQUESTS_PER_SECOND=1000
DURATION_SECONDS=20
MONITOR=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --monitor)
      MONITOR=true
      shift
      ;;
    --rps)
      REQUESTS_PER_SECOND="$2"
      shift 2
      ;;
    --duration)
      DURATION_SECONDS="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      echo "Usage: ./run-load-test.sh [options]"
      echo "Options:"
      echo "  --monitor           Run with Redis and SQLite monitoring"
      echo "  --rps NUMBER        Requests per second (default: 1000)"
      echo "  --duration SECONDS  Test duration in seconds (default: 20)"
      echo "  --verbose           Show more detailed output"
      echo "  --help              Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help to see available options"
      exit 1
      ;;
  esac
done

# Make sure the server is running
echo "Checking if the server is running..."
curl -s http://localhost:3000 > /dev/null
if [ $? -ne 0 ]; then
  echo "Server is not running at http://localhost:3000"
  echo "Please start the server first"
  exit 1
fi

echo "Server is running. Starting load test..."

# Install dependencies if needed
if ! bun -v > /dev/null 2>&1; then
  echo "Bun is not installed. Please install Bun first: https://bun.sh/"
  exit 1
fi

# Check if ioredis is installed
if [ ! -d "node_modules/ioredis" ]; then
  echo "Installing ioredis..."
  bun add ioredis
fi

# Set environment variables for the test
export LOAD_TEST_RPS=$REQUESTS_PER_SECOND
export LOAD_TEST_DURATION=$DURATION_SECONDS
export LOAD_TEST_VERBOSE=$VERBOSE

# Run the appropriate test
if [ "$MONITOR" = true ]; then
  echo "Running load test with monitoring..."
  echo "Requests per second: $REQUESTS_PER_SECOND"
  echo "Duration: $DURATION_SECONDS seconds"
  bun run load-test-with-monitoring.ts
else
  echo "Running basic load test..."
  echo "Requests per second: $REQUESTS_PER_SECOND"
  echo "Duration: $DURATION_SECONDS seconds"
  bun run load-test.ts
fi 