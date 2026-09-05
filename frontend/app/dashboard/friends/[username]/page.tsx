"use client";

import { Alert, Avatar, Box, Button, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { carGradient } from "@/features/cars/car-gradient";
import { usePublicGarage } from "@/hooks/use-friends";

export default function FriendGaragePage() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = usePublicGarage(params.username);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Stack spacing={2}>
        <Button
          onClick={() => router.push("/dashboard/friends")}
          sx={{ alignSelf: "flex-start", color: "text.secondary" }}
        >
          ← Back to friends
        </Button>
        <Alert severity="error">
          Couldn&apos;t load this garage — you may not be friends with this user.
        </Alert>
      </Stack>
    );
  }

  const { user, cars } = data;
  const initial = (user.displayName ?? user.username).charAt(0).toUpperCase();

  return (
    <Stack spacing={3}>
      <Button
        onClick={() => router.push("/dashboard/friends")}
        sx={{ alignSelf: "flex-start", color: "text.secondary" }}
      >
        ← Back to friends
      </Button>

      <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
        <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 64, height: 64, fontSize: 22 }}>
          {initial}
        </Avatar>
        <Box>
          <Typography sx={{ fontSize: 24, fontWeight: 800 }}>
            {user.displayName ?? user.username}&apos;s Garage
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
            @{user.username} · {cars.length} car{cars.length === 1 ? "" : "s"}
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" icon={false} sx={{ display: "inline-flex", alignSelf: "flex-start" }}>
        🔒 You&apos;re viewing a friend&apos;s public garage — spending and expense details are
        private.
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
