import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptFriendRequest,
  getPublicGarage,
  listFriendRequests,
  listFriends,
  rejectFriendRequest,
  sendFriendRequest,
  unfriend,
} from "@/lib/friends-api";

const FRIENDS_KEY = ["friends"] as const;
const REQUESTS_KEY = ["friends", "requests"] as const;

export function useFriends() {
  return useQuery({ queryKey: FRIENDS_KEY, queryFn: listFriends });
}

export function useFriendRequests() {
  return useQuery({ queryKey: REQUESTS_KEY, queryFn: listFriendRequests });
}

export function usePublicGarage(username: string) {
  return useQuery({
    queryKey: ["users", username, "garage"],
    queryFn: () => getPublicGarage(username),
    enabled: !!username,
    retry: false,
  });
}

function useInvalidateFriendsData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: FRIENDS_KEY });
    queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
  };
}

export function useSendFriendRequest() {
  const invalidate = useInvalidateFriendsData();
  return useMutation({
    mutationFn: (username: string) => sendFriendRequest(username),
    onSuccess: invalidate,
  });
}

export function useAcceptFriendRequest() {
  const invalidate = useInvalidateFriendsData();
  return useMutation({
    mutationFn: (id: string) => acceptFriendRequest(id),
    onSuccess: invalidate,
  });
}

export function useRejectFriendRequest() {
  const invalidate = useInvalidateFriendsData();
  return useMutation({
    mutationFn: (id: string) => rejectFriendRequest(id),
    onSuccess: invalidate,
  });
}

export function useUnfriend() {
  const invalidate = useInvalidateFriendsData();
  return useMutation({
    mutationFn: (userId: string) => unfriend(userId),
    onSuccess: invalidate,
  });
}
