"use client";

import { Alert, Avatar, Box, Button, Grid, Skeleton, Stack, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { carGradient } from "@/features/cars/car-gradient";
import { isNotFoundError, NotFoundState, QueryErrorState } from "@/features/shell/query-states";
import { usePublicGarage } from "@/hooks/use-friends";

export default function FriendGaragePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { data, isLoading, error, refetch, isFetching } = usePublicGarage(params.username);

  const backButton = (
    <Button
      onClick={() => router.push("/dashboard/friends")}
      sx={{ alignSelf: "flex-start", color: "text.secondary" }}
    >
      ← Back to friends
    </Button>
  );

  if (isLoading) {
    return (
      <Stack spacing={3} aria-busy="true">
        {backButton}
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <Skeleton variant="circular" width={64} height={64} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="45%" sx={{ fontSize: { xs: 20, sm: 24 } }} />
            <Skeleton variant="text" width="25%" sx={{ fontSize: 13.5 }} />
          </Box>
        </Stack>
        <Grid container spacing={2}>
          {[0, 1, 2].map((index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={130} sx={{ borderRadius: "10px" }} />
              <Skeleton variant="text" width="70%" sx={{ fontSize: 15, mt: 1.5 }} />
            </Grid>
          ))}
        </Grid>
      </Stack>
    );
  }

  // 404 = no such user, 403 = not friends; either way there's no garage to show.
  if (!data && (isNotFoundError(error) || !error)) {
    return (
      <NotFoundState
        title="Garage not found"
        message={`@${params.username} doesn't exist, or you aren't friends yet — only friends can see each other's garages.`}
        backHref="/dashboard/friends"
        backLabel="Back to friends"
      />
    );
  }

  if (!data) {
    return (
      <Stack spacing={2}>
        {backButton}
        <QueryErrorState
          message="Couldn't load this garage."
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      </Stack>
    );
  }

  const { user, cars } = data;
  const initial = (user.displayName ?? user.username).charAt(0).toUpperCase();

  return (
    <Stack spacing={3}>
      {backButton}

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar
          src={user.avatarUrl ?? undefined}
          alt={user.displayName ?? user.username}
          sx={{ width: 64, height: 64, fontSize: 22 }}
        >
          {initial}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: { xs: 20, sm: 24 }, fontWeight: 800, overflowWrap: "anywhere" }}>
            {user.displayName ?? user.username}&apos;s Garage
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
            @{user.username} · {cars.length} car{cars.length === 1 ? "" : "s"}
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" icon={false} sx={{ display: "inline-flex", alignSelf: "flex-start" }}>
        <span aria-hidden="true">🔒</span> You&apos;re viewing a friend&apos;s public garage —
        spending and expense details are private.
      </Alert>

      {cars.length === 0 ? (
        <Typography sx={{ color: "text.secondary", fontSize: 14 }}>No cars yet.</Typography>
      ) : (
        <Grid container spacing={2}>
          {cars.map((car) => (
            <Grid key={car.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Box
                sx={{
                  bgcolor: "background.paper",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: "14px",
                  p: 1.75,
                }}
              >
                <Box
                  sx={{
                    height: 130,
                    borderRadius: "10px",
                    background: carGradient(car.id),
                  }}
                />
                <Typography sx={{ fontSize: 15, fontWeight: 700, mt: 1.5 }}>
                  {car.year} {car.make} {car.model}
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
                  {car.variant} · {car.fuelType}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
