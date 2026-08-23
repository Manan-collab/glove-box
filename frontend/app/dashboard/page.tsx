"use client";

import { Alert, Box, Button, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { CarCard } from "@/features/cars/car-card";
import { CarFormDialog } from "@/features/cars/car-form-dialog";
import { useCars, useCreateCar } from "@/hooks/use-cars";
import { useMe } from "@/hooks/use-auth";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: cars, isLoading, isError } = useCars();
  const createCar = useCreateCar();
  const [addOpen, setAddOpen] = useState(false);

  const carCount = cars?.data.length ?? 0;

  return (
    <Stack spacing={3}>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 2 }}
      >
        <Box>
          <Typography sx={{ fontSize: 14, color: "text.secondary", fontWeight: 500, mb: 0.25 }}>
            {greeting()}, {me?.user.displayName?.split(" ")[0] ?? me?.user.username}.
          </Typography>
          <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Your Garage</Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
            {carCount === 0
              ? "No cars yet."
              : `${carCount} car${carCount > 1 ? "s" : ""} in your garage.`}
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setAddOpen(true)}>
          + Add Car
        </Button>
      </Stack>

      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && <Alert severity="error">Couldn&apos;t load your cars.</Alert>}

      {cars && cars.data.length === 0 && (
        <Alert severity="info">
          No cars yet — click &quot;Add Car&quot; to add your first one.
        </Alert>
      )}

      {cars && cars.data.length > 0 && (
        <Grid container spacing={2}>
          {cars.data.map((car) => (
            <Grid key={car.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CarCard car={car} />
            </Grid>
          ))}
        </Grid>
      )}

      <CarFormDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a car"
        isSubmitting={createCar.isPending}
        error={createCar.error?.message}
        onSubmit={(values) => {
          createCar.mutate(values, {
            onSuccess: () => setAddOpen(false),
          });
        }}
      />
    </Stack>
  );
}
