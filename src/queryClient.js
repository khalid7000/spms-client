// Shared singleton so AuthContext can clear all cached query data across login/logout --
// without that, a new user's session can render the previous user's cached role/permission
// data for up to `staleTime` (role-gated buttons included) since query keys aren't user-scoped.
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})
