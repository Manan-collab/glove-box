"use client";

import { Alert, Box, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { categoryMeta } from "@/features/expenses/expense-categories";
import { useGarageAnalytics } from "@/hooks/use-analytics";

function formatCurrency(value: number) {
  return `₹${Math.round(value).toLocaleString()}`;
}

export default function AnalyticsPage() {
  const { data, isLoading, isError } = useGarageAnalytics();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !data) {
    return <Alert severity="error">Couldn&apos;t load analytics.</Alert>;
  }

  if (data.totalCars === 0) {
    return (
      <Stack spacing={1}>
        <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Analytics</Typography>
        <Alert severity="info">Add a car and log some expenses to see analytics here.</Alert>
      </Stack>
    );
  }

  const maxCategoryTotal = Math.max(...data.spendByCategory.map((c) => c.total), 1);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Analytics</Typography>
        <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
          Where exactly is your money going?
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard value={formatCurrency(data.totalSpend)} label="Total garage spend" accent />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard value={`${data.totalTrackedKm.toLocaleString()} km`} label="Tracked, all cars" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            value={data.averageCostPerKm != null ? `₹${data.averageCostPerKm.toFixed(2)}/km` : "—"}
            label="Average cost"
          />
        </Grid>
      </Grid>

      {data.monthlySpend.length > 0 && (
        <Panel title="Monthly spending">
          <BarChart
            height={260}
            xAxis={[{ data: data.monthlySpend.map((m) => m.month), scaleType: "band" }]}
            series={[
              {
                data: data.monthlySpend.map((m) => m.total),
                color: "var(--mui-palette-primary-main)",
                valueFormatter: (v) => (v != null ? formatCurrency(v) : ""),
              },
            ]}
          />
        </Panel>
      )}

      {data.spendByCategory.length > 0 && (
        <Panel title="By category — all cars">
          <Stack spacing={1.5}>
            {data.spendByCategory
              .sort((a, b) => b.total - a.total)
              .map((row) => {
                const meta = categoryMeta(row.category);
                return (
                  <Stack
                    key={row.category}
                    direction="row"
                    spacing={1.5}
                    sx={{ alignItems: "center" }}
                  >
                    <Typography sx={{ fontSize: 13, width: 90, flexShrink: 0 }}>
                      {meta.icon} {meta.label}
                    </Typography>
                    <Box
                      sx={{
                        flex: 1,
                        height: 9,
                        borderRadius: 20,
                        bgcolor: "background.default",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        sx={{
                          height: "100%",
                          borderRadius: 20,
                          bgcolor: "primary.main",
                          width: `${(row.total / maxCategoryTotal) * 100}%`,
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, width: 90, textAlign: "right" }}>
                      {formatCurrency(row.total)}
                    </Typography>
                  </Stack>
                );
              })}
          </Stack>
        </Panel>
      )}

      <Panel title="Which car is costing you more?">
        <Box sx={{ overflowX: "auto" }}>
          <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <Box component="thead">
              <Box component="tr">
                {["Car", "₹/km", "Tracked", "Total spent"].map((h) => (
                  <Box
                    component="th"
                    key={h}
                    sx={{
                      textAlign: "left",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      color: "text.secondary",
                      py: 1.25,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    {h}
                  </Box>
                ))}
              </Box>
            </Box>
            <Box component="tbody">
              {data.carComparison
                .slice()
                .sort((a, b) => b.totalSpend - a.totalSpend)
                .map((car) => (
                  <Box component="tr" key={car.carId}>
                    <Box component="td" sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                      {car.year} {car.make} {car.model}
                    </Box>
                    <Box component="td" sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                      {car.costPerKm != null ? `₹${car.costPerKm.toFixed(2)}` : "—"}
                    </Box>
                    <Box component="td" sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                      {car.trackedKm != null ? `${car.trackedKm.toLocaleString()} km` : "—"}
                    </Box>
                    <Box component="td" sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                      {formatCurrency(car.totalSpend)}
                    </Box>
                  </Box>
                ))}
            </Box>
          </Box>
        </Box>
      </Panel>
    </Stack>
  );
}

function StatCard({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        p: "20px 22px",
      }}
    >
      <Typography sx={{ fontSize: 26, fontWeight: 800, color: accent ? "primary.main" : "text.primary" }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        p: "20px 22px",
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 2 }}>{title}</Typography>
      {children}
    </Box>
  );
}
