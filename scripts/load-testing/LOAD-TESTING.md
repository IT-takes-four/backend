# Load Testing for Game Search API

This directory contains scripts for load testing the `/games/search` endpoint of the Quokka API.

## Scripts

- `load-test.ts`: Basic load test that sends a configurable number of requests per second
- `load-test-with-monitoring.ts`: Advanced load test that also monitors Redis and SQLite
- `run-load-test.sh`: Shell script to run either of the load tests with various options

## Features

- **Diverse Search Queries**: Over 150 different search terms including:

  - Popular game titles
  - Specific game titles
  - Game genres and categories
  - Game studios and publishers
  - Partial and misspelled searches
  - Random characters and short queries
  - Longer phrases
  - Non-English searches
  - Special characters and symbols
  - New and classic games

- **Random Query Generation**:

  - 70% chance: Use a predefined game name
  - 10% chance: Combine two game names (e.g., "zelda minecraft")
  - 10% chance: Add a qualifier to a game name (e.g., "best rpg")
  - 10% chance: Generate a completely random string

- **Realistic Load Simulation**:
  - Concurrent requests
  - Configurable requests per second
  - Configurable test duration
  - Detailed statistics

## Prerequisites

- [Bun](https://bun.sh/) installed
- Redis server running (for monitoring)
- SQLite database file (`games.db`) accessible
- Quokka API server running at http://localhost:3030

## Usage

Make the run script executable:

```bash
chmod +x run-load-test.sh
```

### Basic Usage

Run a basic load test with default settings (1000 requests per second for 20 seconds):

```bash
./run-load-test.sh
```

Run with monitoring (checks Redis and SQLite stats):

```bash
./run-load-test.sh --monitor
```

### Advanced Options

```bash
# Run with 5000 requests per second for 30 seconds
./run-load-test.sh --rps 5000 --duration 30

# Run with monitoring and verbose output
./run-load-test.sh --monitor --verbose

# Show help
./run-load-test.sh --help
```

## Troubleshooting

### Connection Errors

If you see errors like:

```
Request error: Error: The socket connection was closed unexpectedly.
```

This usually means your server can't handle the load. Try reducing the requests per second:

```bash
./run-load-test.sh --rps 500
```

### Redis or SQLite Errors

If you see errors related to Redis or SQLite during monitoring:

```
Error getting Redis stats: Connection is closed.
Error getting SQLite stats: RangeError: Cannot use a closed database
```

The scripts will attempt to reconnect automatically. These errors are normal under high load and don't necessarily indicate a problem with your implementation.

## Interpreting Results

The load test will output statistics including:

- Total requests sent
- Successful vs. failed requests
- Average, min, and max response times
- Requests per second achieved

With monitoring enabled, you'll also see:

- Redis queue lengths
- Number of search locks and caches
- SQLite database record counts

## Example Output

```
--- Load Test Results ---
Total time: 20.15 seconds
Total requests: 20000
Successful requests: 19987
Failed requests: 13
Requests per second: 992.56
Average response time: 45.32 ms
Min response time: 12.45 ms
Max response time: 203.67 ms

--- Final Redis Stats ---
Redis Queue Length: 42
Redis Processing Length: 3
Redis Search Locks: 5
Redis Search Caches: 26

--- Final SQLite Stats ---
SQLite Game Count: 1250
SQLite Cover Count: 1250
SQLite Screenshot Count: 3750
SQLite Platform Count: 45
SQLite Genre Count: 32
```
