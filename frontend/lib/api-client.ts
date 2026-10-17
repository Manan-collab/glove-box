// Same-origin on purpose — next.config.ts proxies this to the backend so the
// auth cookies stay first-party.
export const API_BASE_URL = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// A dashboard load fires several queries at once; once the 15-minute access
// token expires they all 401 together. Share one in-flight refresh between
// them instead of sending a burst of /auth/refresh calls at the rate limiter.
let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshInFlight ??= fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    // A network error rejects rather than resolving false, so a blip
    // surfaces as a retryable error instead of a 401 that signs the user out.
    .then((res) => res.ok)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

// Shared by the JSON request() helper below and by data-io-api.ts's raw
// fetch calls (multipart upload, Blob download) — those can't go through
// request() since it hardcodes a JSON Content-Type and JSON-parses the body,
// but they still need the same "access token expired mid-action" resilience.
export async function fetchWithRefresh(
  path: string,
  init: RequestInit = {},
  isRetry = false,
): Promise<Response> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
  });

  if (res.status === 401 && !isRetry && path !== "/auth/refresh") {
    if (await refreshSession()) {
      return fetchWithRefresh(path, init, true);
    }
  }

  return res;
}

export async function throwApiError(res: Response): Promise<never> {
  const body: unknown = await res.json().catch(() => ({}));
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message)
      : "Request failed";
  throw new ApiError(res.status, message);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchWithRefresh(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (!res.ok) {
    return throwApiError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
