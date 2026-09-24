import Constants from "expo-constants";
import { createTRPCReact } from "@trpc/react-query";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import { QueryClient } from "@tanstack/react-query";
import superjson from "superjson";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../server/routers";

const configured =
  process.env.EXPO_PUBLIC_API_URL ?? "https://r-aero-academy.com";
const origin = new URL(configured);
if (
  origin.username ||
  origin.password ||
  origin.search ||
  origin.hash ||
  origin.pathname !== "/"
)
  throw new Error(
    "L’adresse de l’API doit être une origine sans chemin ni identifiant."
  );
if (
  origin.protocol !== "https:" &&
  !(__DEV__ || Constants.expoConfig?.extra?.variant === "qa")
)
  throw new Error("HTTPS est obligatoire pour la version de production.");
if (!["http:", "https:"].includes(origin.protocol))
  throw new Error("Protocole d’API non autorisé.");
export const API_ORIGIN = origin.origin;
let token: string | null = null;
export const sessionToken = () => token;
export const setSessionToken = (value: string | null) => {
  token = value;
};

/** Do not disclose the session to externally hosted course images, video or links. */
export function mediaSource(value: string) {
  const url = new URL(value, API_ORIGIN);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Adresse de ressource non autorisée.");
  if (
    url.protocol !== "https:" &&
    !(__DEV__ || Constants.expoConfig?.extra?.variant === "qa")
  )
    throw new Error("Ce média nécessite une adresse HTTPS.");
  return {
    uri: url.href,
    headers:
      url.origin === API_ORIGIN && token
        ? { Authorization: `Bearer ${token}` }
        : undefined,
  };
}

const links = () => [
  httpBatchLink({
    url: `${API_ORIGIN}/api/trpc`,
    transformer: superjson,
    headers: () => ({
      "x-raero-client": "native",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    }),
    fetch: async (url, options) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      if (options?.signal?.aborted) abort();
      options?.signal?.addEventListener("abort", abort);
      const deadline = setTimeout(abort, 25_000);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } catch {
        throw new Error(
          "Connexion interrompue ou trop lente. Vérifiez votre réseau et réessayez."
        );
      } finally {
        clearTimeout(deadline);
        options?.signal?.removeEventListener("abort", abort);
      }
    },
  }),
];
export const api = createTRPCReact<AppRouter>();
export const apiClient = createTRPCProxyClient<AppRouter>({ links: links() });
export const reactClient = api.createClient({ links: links() });
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error: any) =>
        error?.data?.code !== "UNAUTHORIZED" && count < 2,
      staleTime: 15_000,
    },
    mutations: { retry: false },
  },
});
export type Outputs = inferRouterOutputs<AppRouter>;
export type Learner = NonNullable<Outputs["auth"]["me"]>;
export type Enrollment = Outputs["dashboard"]["enrollments"][number];
