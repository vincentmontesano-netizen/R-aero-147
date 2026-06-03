import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Do not retry on UNAUTHORIZED — avoids infinite loops on protected procedures
      retry: (failureCount, error) => {
        if (error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED') return false;
        return failureCount < 2;
      },
    },
  },
});

// Paths that should NOT trigger a redirect on 401 (expected protected calls from public pages)
const SILENT_UNAUTH_PATHS = ['cart.count', 'cart.list', 'dashboard.', 'company.', 'admin.'];

const redirectToLoginIfUnauthorized = (error: unknown, queryKey?: readonly unknown[]) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  // Ignore expected 401s on protected procedures called from public pages
  const path = String(queryKey?.[0] ?? '');
  if (SILENT_UNAUTH_PATHS.some(p => path.includes(p))) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    const queryKey = event.query.queryKey;
    redirectToLoginIfUnauthorized(error, queryKey);
    // Only log non-UNAUTHORIZED errors to avoid noise
    if (!(error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED')) {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
