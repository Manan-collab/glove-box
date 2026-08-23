import { apiClient } from "./api-client";

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendRequestItem {
  id: string;
  createdAt: string;
  user: PublicProfile;
}

export interface FriendRequests {
  incoming: FriendRequestItem[];
  outgoing: FriendRequestItem[];
}

export interface PublicCar {
  id: string;
  make: string;
  model: string;
  year: number;
  variant: string;
  engine: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  powerBhp: number | null;
  createdAt: string;
}

export interface PublicGarage {
  user: PublicProfile;
  cars: PublicCar[];
}

export function listFriends() {
  return apiClient.get<PublicProfile[]>("/friends");
}

export function listFriendRequests() {
  return apiClient.get<FriendRequests>("/friends/requests");
}

export function sendFriendRequest(username: string) {
  return apiClient.post<FriendRequestItem>(`/friends/requests/${username}`);
}

export function acceptFriendRequest(id: string) {
  return apiClient.post<void>(`/friends/requests/${id}/accept`);
}

export function rejectFriendRequest(id: string) {
  return apiClient.post<void>(`/friends/requests/${id}/reject`);
}

export function unfriend(userId: string) {
  return apiClient.del(`/friends/${userId}`);
}

export function getPublicGarage(username: string) {
  return apiClient.get<PublicGarage>(`/users/${username}/garage`);
}
