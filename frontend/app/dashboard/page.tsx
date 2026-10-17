"use client";

import { Alert, Box, Button, Grid, Skeleton, Stack, Typography } from "@mui/material";
import { useState } from "react";
import { CarCard } from "@/features/cars/car-card";
import { CarFormDialog } from "@/features/cars/car-form-dialog";
import { DataIoDialog } from "@/features/data-io/data-io-dialog";
import { Panel, PanelLoading, StatCard } from "@/features/analytics/analytics-ui";
import { categoryMeta } from "@/features/expenses/expense-categories";
import { QueryErrorState } from "@/features/shell/query-states";
import { useGarageAnalytics } from "@/hooks/use-analytics";
import { useCars, useCreateCar } from "@/hooks/use-cars";
import { useMe } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/format-currency";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const { data: me } = useMe();
  const { data: cars, isLoading, isError, refetch, isFetching } = useCars();
  const {
    data: analytics,
    isLoading: analyticsLoading,
    isError: analyticsError,
    refetch: refetchAnalytics,
    isFetching: analyticsFetching,
  } = useGarageAnalytics();
  const createCar = useCreateCar();
  const [addOpen, setAddOpen] = useState(false);
  const [dataIoOpen, setDataIoOpen] = useState(false);

  const carCount = cars?.data.length ?? 0;
  const spentLabel = analyticsLoading ? "…" : analytics ? formatCurrency(analytics.totalSpend) : "—";
  const analyticsErrorState = (message: string) => (
    <QueryErrorState message={message} onRetry={() => refetchAnalytics()} retrying={analyticsFetching} />
  );

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
          {isLoading ? (
            <Skeleton variant="text" width={240} sx={{ fontSize: 14, mt: 0.5 }} />
          ) : (
            cars && (
              <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
                {carCount === 0
                  ? "No cars yet."
                  : `${carCount} car${carCount > 1 ? "s" : ""}. ${spentLabel} spent. Questionable decisions.`}
              </Typography>
            )
          )}
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={() => setDataIoOpen(true)}>
            Import / Export
          </Button>
          <Button variant="contained" onClick={() => setAddOpen(true)}>
            + Add Car
          </Button>
        </Stack>
      </Stack>

      {isLoading && (
        <Grid container spacing={2} aria-busy="true">
          {[0, 1, 2].map((index) => (
            <Grid key={index} size={{ xs: 12, sm: 6, md: 4 }}>
              <Skeleton variant="rounded" height={150} sx={{ borderRadius: "10px" }} />
              <Skeleton variant="text" width="70%" sx={{ fontSize: 15.5, mt: 1.5 }} />
              <Skeleton variant="text" width="45%" sx={{ fontSize: 12.5 }} />
            </Grid>
          ))}
        </Grid>
      )}

      {isError && !cars && (
        <QueryErrorState message="Couldn't load your cars." onRetry={() => refetch()} retrying={isFetching} />
      )}

      {cars && cars.data.length === 0 && (
        <Alert severity="info">
          No cars yet — click &quot;Add Car&quot; to add your first one.
        </Alert>
      )}

      {carCount > 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              value={analytics ? formatCurrency(analytics.totalSpend) : "—"}
              label="Total spent"
              accent
              loading={analyticsLoading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              value={analytics ? `${analytics.totalTrackedKm.toLocaleString()} km` : "—"}
              label="Tracked"
              loading={analyticsLoading}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <StatCard
              value={analytics?.averageCostPerKm != null ? `₹${analytics.averageCostPerKm.toFixed(2)}/km` : "—"}
              label="Average cost"
              loading={analyticsLoading}
            />
          </Grid>
        </Grid>
      )}

      {cars && cars.data.length > 0 && (
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", color: "text.secondary" }}>
            YOUR CARS
            <Box component="span" sx={{ "@media (hover: none)": { display: "none" } }}>
              {" "}— HOVER FOR A QUICK LOOK
            </Box>
          </Typography>
          <Grid container spacing={2}>
            {cars.data.map((car) => (
              <Grid key={car.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <CarCard car={car} />
              </Grid>
            ))}
          </Grid>
        </Stack>
      )}

      {carCount > 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Panel title="Recent Expenses">
              {analyticsLoading ? (
                <PanelLoading />
              ) : !analytics ? (
                analyticsError && analyticsErrorState("Couldn't load recent expenses.")
              ) : analytics.recentExpenses.length === 0 ? (
                <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                  No expenses logged yet.
                </Typography>
              ) : (
                <Stack spacing={0}>
                  {analytics.recentExpenses.map((expense, index) => {
                    const meta = categoryMeta(expense.category);
                    return (
                      <Stack
                        key={expense.id}
                        direction="row"
                        spacing={1.5}
                        sx={{
                          alignItems: "center",
                          py: 1.25,
                          borderBottom: index < analytics.recentExpenses.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "9px",
                            bgcolor: "background.default",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 16,
                            flexShrink: 0,
                          }}
                          aria-hidden="true"
                        >
                          {meta.icon}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{meta.label}</Typography>
                          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                            {expense.carLabel}
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "right" }}>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                            {formatCurrency(expense.amount)}
                          </Typography>
                          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                            {formatDate(expense.expenseDate)}
                          </Typography>
                        </Box>
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </Panel>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Panel title="This Month">
              {analyticsLoading ? (
                <PanelLoading rows={4} />
              ) : !analytics ? (
                analyticsError && analyticsErrorState("Couldn't load this month's spending.")
              ) : analytics.currentMonthSpendByCategory.length === 0 ? (
                <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                  No spending logged yet this month.
                </Typography>
              ) : (
                <Stack spacing={1.25}>
                  {analytics.currentMonthSpendByCategory
                    .slice()
                    .sort((a, b) => b.total - a.total)
                    .map((row) => {
                      const meta = categoryMeta(row.category);
                      return (
                        <Stack
                          key={row.category}
                          direction="row"
                          sx={{ justifyContent: "space-between", fontSize: 13.5 }}
                        >
                          <Typography sx={{ fontSize: 13.5 }}>{meta.label}</Typography>
                          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
                            {formatCurrency(row.total)}
                          </Typography>
                        </Stack>
                      );
                    })}
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: "space-between",
                      pt: 1.25,
                      mt: 0.25,
                      borderTop: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Total</Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                      {formatCurrency(
                        analytics.currentMonthSpendByCategory.reduce((sum, row) => sum + row.total, 0),
                      )}
                    </Typography>
                  </Stack>
                  <Typography sx={{ fontSize: 12, color: "primary.main", fontWeight: 600 }}>
                    Not terrible, all things considered.
                  </Typography>
                </Stack>
              )}
            </Panel>
          </Grid>
        </Grid>
      )}

      <CarFormDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          // Don't greet the next "Add car" with the last attempt's error.
          createCar.reset();
        }}
        title="Add a car"
        isSubmitting={createCar.isPending}
        error={createCar.error?.message}
        onSubmit={(values) => {
          createCar.mutate(values, {
            onSuccess: () => setAddOpen(false),
          });
        }}
      />

      <DataIoDialog open={dataIoOpen} onClose={() => setDataIoOpen(false)} />
    </Stack>
  );
}
