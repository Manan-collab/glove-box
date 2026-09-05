"use client";

import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useState } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  useAcceptFriendRequest,
  useFriendRequests,
  useFriends,
  useRejectFriendRequest,
  useSearchUsers,
  useSendFriendRequest,
} from "@/hooks/use-friends";
import type { PublicProfile, SearchedUser } from "@/lib/friends-api";

export default function FriendsPage() {
  const { data: friends, isLoading: friendsLoading } = useFriends();
  const { data: requests, isLoading: requestsLoading } = useFriendRequests();
  const sendRequest = useSendFriendRequest();
  const acceptRequest = useAcceptFriendRequest();
  const rejectRequest = useRejectFriendRequest();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const { data: searchResults, isFetching: searchFetching } = useSearchUsers(debouncedSearch);

  const incoming = requests?.incoming ?? [];
  const outgoing = requests?.outgoing ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Friends</Typography>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
          See what other enthusiasts are running.
        </Typography>
      </Box>

      <Autocomplete<SearchedUser>
        sx={{ maxWidth: 420 }}
        size="small"
        options={searchResults ?? []}
        loading={searchFetching}
        filterOptions={(options) => options}
        value={null}
        inputValue={searchInput}
        onInputChange={(_, newValue, reason) => {
          if (reason === "reset") return;
          setSearchInput(newValue);
        }}
        onChange={(_, selected) => {
          if (!selected) return;
          sendRequest.mutate(selected.username);
          setSearchInput("");
        }}
        getOptionLabel={(option) => option.username}
        isOptionEqualToValue={(option, val) => option.id === val.id}
        getOptionDisabled={(option) => option.status !== "NONE"}
        noOptionsText={debouncedSearch.trim() ? "No matching users" : "Type a username or name to search"}
        renderOption={({ key, ...liProps }, option) => (
          <Box
            component="li"
            key={key}
            {...liProps}
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}
          >
            <ProfileRow profile={option} />
            <FriendStatusHint status={option.status} />
          </Box>
        )}
        renderInput={(params) => (
          <TextField {...params} placeholder="Search by username or name" />
        )}
      />
      {sendRequest.isError && (
        <Alert severity="error" sx={{ maxWidth: 420 }}>
          {sendRequest.error.message}
        </Alert>
      )}

      {(friendsLoading || requestsLoading) && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {incoming.length > 0 && (
        <Box>
          <SectionLabel>Friend requests</SectionLabel>
          <Panel>
            <Stack spacing={1.5}>
              {incoming.map((req) => (
                <Stack
                  key={req.id}
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <ProfileRow profile={req.user} />
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      loading={acceptRequest.isPending && acceptRequest.variables === req.id}
                      disabled={rejectRequest.isPending && rejectRequest.variables === req.id}
                      onClick={() => acceptRequest.mutate(req.id)}
                    >
                      Accept
                    </Button>
                    <Button
                      size="small"
                      loading={rejectRequest.isPending && rejectRequest.variables === req.id}
                      disabled={acceptRequest.isPending && acceptRequest.variables === req.id}
                      onClick={() => rejectRequest.mutate(req.id)}
                    >
                      Decline
                    </Button>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Panel>
        </Box>
      )}

      {outgoing.length > 0 && (
        <Box>
          <SectionLabel>Sent requests</SectionLabel>
          <Panel>
            <Stack spacing={1.5}>
              {outgoing.map((req) => (
                <Stack
                  key={req.id}
                  direction="row"
                  sx={{ alignItems: "center", justifyContent: "space-between" }}
                >
                  <ProfileRow profile={req.user} />
                  <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
                    Pending
                  </Typography>
                </Stack>
              ))}
            </Stack>
          </Panel>
        </Box>
      )}

      <Box>
        <SectionLabel>Your friends</SectionLabel>
        {!friendsLoading && !requestsLoading && friends && friends.length === 0 && (
          <Alert severity="info">
            No friends yet — send a request above to get started.
          </Alert>
        )}
        {friends && friends.length > 0 && (
          <Grid container spacing={2}>
            {friends.map((friend) => (
              <Grid key={friend.id} size={{ xs: 12, sm: 6 }}>
                <Panel>
                  <Stack
                    direction="row"
                    sx={{ alignItems: "center", justifyContent: "space-between" }}
                  >
                    <ProfileRow profile={friend} />
                    <Button
                      size="small"
                      variant="contained"
                      component={Link}
                      href={`/dashboard/friends/${friend.username}`}
                    >
                      View Garage →
                    </Button>
                  </Stack>
                </Panel>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}

function ProfileRow({ profile }: { profile: PublicProfile }) {
  const initial = (profile.displayName ?? profile.username).charAt(0).toUpperCase();
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
      <Avatar src={profile.avatarUrl ?? undefined} sx={{ width: 40, height: 40 }}>
        {initial}
      </Avatar>
      <Box>
        <Typography sx={{ fontSize: 14.5, fontWeight: 700 }}>
          {profile.displayName ?? profile.username}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>
          @{profile.username}
        </Typography>
      </Box>
    </Stack>
  );
}

function FriendStatusHint({ status }: { status: SearchedUser["status"] }) {
  switch (status) {
    case "FRIENDS":
      return <Chip size="small" label="Friends" />;
    case "REQUEST_SENT":
      return (
        <Typography sx={{ fontSize: 12, color: "text.secondary", flexShrink: 0 }}>
          Requested
        </Typography>
      );
    case "REQUEST_RECEIVED":
      return (
        <Typography sx={{ fontSize: 12, color: "warning.main", flexShrink: 0 }}>
          Respond below
        </Typography>
      );
    default:
      return (
        <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: "primary.main", flexShrink: 0 }}>
          + Send
        </Typography>
      );
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontSize: 13,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: "text.secondary",
        mb: 1.5,
      }}
    >
      {children}
    </Typography>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        p: 2.5,
      }}
    >
      {children}
    </Box>
  );
}
