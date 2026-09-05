import { apiClient } from "./api-client";

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

export function googleAuth(credential: string) {
  return apiClient.post<UserResponse>("/auth/google", { credential });
}

export function getMe() {
  return apiClient.get<UserResponse>("/auth/me");
}

export function logout() {
  return apiClient.post<{ success: boolean }>("/auth/logout");
}
