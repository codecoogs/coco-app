import type {
  PointCategoriesResponse,
  PointTransactionsResponse,
  UserPointsResponse,
} from "./types";

/** CodeCoogs API base URL (e.g. https://api.codecoogs.com/v1). Set NEXT_PUBLIC_CODECOOGS_API_URL in .env. */
const EXTERNAL_API =
  process.env.NEXT_PUBLIC_CODECOOGS_API_URL ?? "https://api.codecoogs.com/v1";

/** In the browser we use our API proxy to avoid CORS; on the server we call the API directly. */
function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/codecoogs`;
  }
  return EXTERNAL_API;
}

type FetchOptions = RequestInit & { params?: Record<string, string> };

async function fetchApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...init } = options;
  const base = getBaseUrl();
  const url = new URL(path.startsWith("http") ? path : `${base}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? res.statusText);
  }
  return json as T;
}

/** GET /v1/users/points?categories=true */
export function getPointCategories() {
  return fetchApi<PointCategoriesResponse>("/users/points", {
    params: { categories: "true" },
  });
}

/** GET /v1/users/points?transactions=true&email=... (or id / discordId) */
export function getPointTransactionsByEmail(email: string) {
  return fetchApi<PointTransactionsResponse>("/users/points", {
    params: { transactions: "true", email },
  });
}

export function getPointTransactionsById(id: string) {
  return fetchApi<PointTransactionsResponse>("/users/points", {
    params: { transactions: "true", id },
  });
}

export function getPointTransactionsByDiscordId(discordId: string) {
  return fetchApi<PointTransactionsResponse>("/users/points", {
    params: { transactions: "true", discordId },
  });
}

/** GET /v1/users/points?email=... (name + total points) */
export function getUserPointsByEmail(email: string) {
  return fetchApi<UserPointsResponse>("/users/points", {
    params: { email },
  });
}

export function getUserPointsById(id: string) {
  return fetchApi<UserPointsResponse>("/users/points", {
    params: { id },
  });
}

export function getUserPointsByDiscordId(discordId: string) {
  return fetchApi<UserPointsResponse>("/users/points", {
    params: { discordId },
  });
}
