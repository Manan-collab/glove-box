import { ApiError, apiClient } from "./api-client";

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

interface UserResponse {
  user: SafeUser;
}

// Sign-in succeeded on the server but the browser didn't keep the session
// cookie (cookies blocked for this site), so every later request is a 401.
export class SessionCookieBlockedError extends Error {
  constructor() {
    super("Session cookie was not stored");
    this.name = "SessionCookieBlockedError";
  }
}

export async function googleAuth(credential: string) {
  const data = await apiClient.post<UserResponse>("/auth/google", { credential });
  // Confirm the cookie stuck before reporting success. Otherwise the caller
  // shows the dashboard from the response body, the next request 401s, and
  // the user is bounced back to /login with no explanation.
  try {
    await getMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw new SessionCookieBlockedError();
    }
    // Anything else (network blip, 429) isn't evidence the cookie is
    // missing — let the dashboard's own error handling deal with it.
  }
  return data;
}

export function getMe() {
  return apiClient.get<UserResponse>("/auth/me");
}

export function logout() {
  return apiClient.post<{ success: boolean }>("/auth/logout");
}
