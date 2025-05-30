# @playdamnit/api-client

Auto-generated API client for PlayDamnit using Orval and React Query.

## Installation

```bash
npm install @playdamnit/api-client
# or
yarn add @playdamnit/api-client
# or
pnpm add @playdamnit/api-client
# or
bun add @playdamnit/api-client
```

## Usage

This package provides React Query hooks for all API endpoints defined in the PlayDamnit OpenAPI specification.

### Setup

First, wrap your app with the QueryClient provider:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app components */}
    </QueryClientProvider>
  );
}
```

### Environment Variables

Make sure to set the API base URL:

```env
NEXT_PUBLIC_API_URL=https://your-api-domain.com
```

### Using the hooks

```tsx
import { useGetApiGames, useGetApiMe } from "@playdamnit/api-client";

function GamesList() {
  const {
    data: games,
    isLoading,
    error,
  } = useGetApiGames({
    limit: 20,
    offset: 0,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {games?.results.map((game) => <div key={game.id}>{game.name}</div>)}
    </div>
  );
}

function UserProfile() {
  const { data: user } = useGetApiMe();

  return <div>{user && <h1>Welcome, {user.name}!</h1>}</div>;
}
```

## Features

- ✅ Full TypeScript support
- ✅ React Query integration
- ✅ Automatic request/response typing
- ✅ Built-in error handling
- ✅ Optimistic updates
- ✅ Caching and background refetching

## Generated from

This package is automatically generated from the OpenAPI specification at `spec.yaml` in the backend repository.

## Support

For issues related to the API client, please check the main repository at [github.com/playdamnit/backend](github.com/playdamnit/backend).
