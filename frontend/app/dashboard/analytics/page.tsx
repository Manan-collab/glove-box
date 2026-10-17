"use client";

import { Alert, Box, Button, Chip, Grid, MenuItem, Skeleton, Stack, TextField, Typography } from "@mui/material";
import { BarChart } from "@mui/x-charts/BarChart";
import { useState } from "react";
import { CategoryBreakdownBars, Panel, StatCard } from "@/features/analytics/analytics-ui";
import { HealthGauge } from "@/features/analytics/health-gauge";
import { YearOverYearPanel } from "@/features/analytics/year-over-year-panel";
import { QuickAddExpenseDialog } from "@/features/expenses/quick-add-expense-dialog";
import { QueryErrorState } from "@/features/shell/query-states";
import { useCarAnalytics, useGarageAnalytics } from "@/hooks/use-analytics";
import { useCar, useCars } from "@/hooks/use-cars";
import { useExpenses } from "@/hooks/use-expenses";
import type { AnalyticsPeriod, CarComparison, MonthlySpend } from "@/lib/analytics-api";
import type { Car } from "@/lib/cars-api";
import { getHealthScore } from "@/lib/car-facts";
import { formatCurrency, formatCurrencyCompact } from "@/lib/format-currency";

const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "ALL", label: "All time" },
  { value: "LAST_30_DAYS", label: "Last 30 days" },
  { value: "LAST_6_MONTHS", label: "Last 6 months" },
  { value: "LAST_1_YEAR", label: "Last 1 year" },
];

interface Badges {
  mostExpensive: string;
  bestFuelEconomy: string | null;
  mostReliable: string;
}

function computeBadges(carComparison: CarComparison[], cars: Car[]): Badges | null {
  if (carComparison.length < 2) return null;

  const mostExpensive = carComparison.reduce((a, b) => (b.totalSpend > a.totalSpend ? b : a));

  const withCostPerKm = carComparison.filter((c) => c.costPerKm != null);
  const bestFuelEconomy =
    withCostPerKm.length > 0
      ? withCostPerKm.reduce((a, b) => ((b.costPerKm as number) < (a.costPerKm as number) ? b : a))
      : null;

  // Normalized by ownership duration so a brand-new car isn't unfairly
  // rewarded (or an old one unfairly punished) just for having had less
  // time to accumulate repairs.
  const withRepairPerYear = carComparison.map((c) => {
    const car = cars.find((candidate) => candidate.id === c.carId);
    const yearsOwned = car
      ? Math.max((Date.now() - new Date(car.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365.25), 0.25)
      : 1;
    return { carId: c.carId, repairPerYear: c.repairSpend / yearsOwned };
  });
  const mostReliable = withRepairPerYear.reduce((a, b) => (b.repairPerYear < a.repairPerYear ? b : a));

  return {
    mostExpensive: mostExpensive.carId,
    bestFuelEconomy: bestFuelEconomy?.carId ?? null,
    mostReliable: mostReliable.carId,
  };
}

function formatMonth(month: string) {
  return new Date(`${month}-01`).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function mostExpensiveMonth(monthlySpend: MonthlySpend[]) {
  if (monthlySpend.length === 0) return null;
  const peak = monthlySpend.reduce((a, b) => (b.total > a.total ? b : a));
  return { ...peak, label: formatMonth(peak.month) };
}

export default function AnalyticsPage() {
  const [carFilter, setCarFilter] = useState("ALL");
  const [period, setPeriod] = useState<AnalyticsPeriod>("ALL");
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);

  const { data: cars, isLoading: carsLoading } = useCars();
  const isSingleCar = carFilter !== "ALL";
  const garageQuery = useGarageAnalytics(period);
  const { data: garageData, isLoading: garageLoading } = garageQuery;
  const carAnalyticsQuery = useCarAnalytics(isSingleCar ? carFilter : "", period);
  const { data: carAnalyticsData, isLoading: carAnalyticsLoading } = carAnalyticsQuery;
  const { data: selectedCar, isLoading: selectedCarLoading } = useCar(isSingleCar ? carFilter : "");
  const { data: selectedCarExpensesPage, isLoading: selectedCarExpensesLoading } = useExpenses(
    isSingleCar ? carFilter : "",
  );
  const isLoading =
    garageLoading ||
    carsLoading ||
    (isSingleCar && (carAnalyticsLoading || selectedCarLoading || selectedCarExpensesLoading));

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (!garageData) {
    return (
      <Stack spacing={2}>
        <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Analytics</Typography>
        <QueryErrorState
          message="Couldn't load analytics."
          onRetry={() => garageQuery.refetch()}
          retrying={garageQuery.isFetching}
        />
      </Stack>
    );
  }

  if (garageData.totalCars === 0) {
    return (
      <Stack spacing={1}>
        <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Analytics</Typography>
        <Alert severity="info">Add a car and log some expenses to see analytics here.</Alert>
      </Stack>
    );
  }

  // A failed single-car query must not fall back to the garage-wide numbers —
  // they'd be shown under that car's name.
  const singleCarFailed = isSingleCar && !carAnalyticsData;
  const active = isSingleCar && carAnalyticsData ? carAnalyticsData : garageData;
  const totalSpend = active.totalSpend;
  const trackedKm = isSingleCar ? carAnalyticsData?.trackedKm ?? null : garageData.totalTrackedKm;
  const peak = mostExpensiveMonth(active.monthlySpend);
  const badges =
    !isSingleCar && cars ? computeBadges(garageData.carComparison, cars.data) : null;
  // Without the expense list (failed to load) the score would be computed
  // from nothing, so the panel is skipped instead.
  const health =
    isSingleCar && selectedCar && selectedCarExpensesPage
      ? getHealthScore(selectedCar, selectedCarExpensesPage.data)
      : null;
  const months = active.monthlySpend;
  const chartSummary =
    months.length > 0
      ? `Monthly spending bar chart, ${formatMonth(months[0].month)} to ${formatMonth(
          months[months.length - 1].month,
        )}.${peak ? ` Highest: ${peak.label} at ${formatCurrency(peak.total)}.` : ""}`
      : "";

  return (
    <Stack spacing={3}>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Analytics</Typography>
          <Typography sx={{ fontSize: 14, color: "text.secondary", mt: 0.5 }}>
            Where exactly is your money going?
          </Typography>
        </Box>
        <Button variant="contained" onClick={() => setAddExpenseOpen(true)}>
          + Add Expense
        </Button>
      </Stack>

      <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <TextField
          select
          size="small"
          value={carFilter}
          onChange={(e) => setCarFilter(e.target.value)}
          sx={{ minWidth: 180, flex: { xs: "1 1 180px", sm: "0 0 auto" } }}
        >
          <MenuItem value="ALL">All cars</MenuItem>
          {cars?.data.map((car) => (
            <MenuItem key={car.id} value={car.id}>
              {car.year} {car.make} {car.model}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          value={period}
          onChange={(e) => setPeriod(e.target.value as AnalyticsPeriod)}
          sx={{ minWidth: 160, flex: { xs: "1 1 160px", sm: "0 0 auto" } }}
        >
          {PERIOD_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {singleCarFailed ? (
        <QueryErrorState
          message="Couldn't load analytics for this car."
          onRetry={() => carAnalyticsQuery.refetch()}
          retrying={carAnalyticsQuery.isFetching}
        />
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard value={formatCurrency(totalSpend)} label="Total spend" accent />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard value={trackedKm != null ? `${trackedKm.toLocaleString()} km` : "—"} label="Tracked" />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                value={peak ? formatCurrency(peak.total) : "—"}
                label={peak ? `Most expensive: ${peak.label}` : "Most expensive month"}
              />
            </Grid>
          </Grid>

          {isSingleCar && health && (
            <Panel title="Health score">
              <HealthGauge health={health} />
            </Panel>
          )}

          {active.monthlySpend.length > 0 && (
            <Panel title="Monthly spending">
              {/* The SVG's axis text isn't meaningful read out of context, so
                  screen readers get a one-line summary instead. */}
              <Box role="img" aria-label={chartSummary}>
                <BarChart
                  height={260}
                  xAxis={[{ data: active.monthlySpend.map((m) => m.month), scaleType: "band" }]}
                  yAxis={[{ valueFormatter: (v: number) => formatCurrencyCompact(v), width: 52 }]}
                  series={[
                    {
                      data: active.monthlySpend.map((m) => m.total),
                      color: "var(--mui-palette-primary-main)",
                      valueFormatter: (v) => (v != null ? formatCurrency(v) : ""),
                    },
                  ]}
                />
              </Box>
            </Panel>
          )}

          {active.spendByCategory.length > 0 && (
            <Panel title={isSingleCar ? "By category" : "By category — all cars"}>
              <CategoryBreakdownBars rows={active.spendByCategory} />
            </Panel>
          )}

          {(active.yearOverYear.totalThisYear > 0 || active.yearOverYear.totalLastYear > 0) && (
            <Panel title={`${active.yearOverYear.lastYearLabel} vs ${active.yearOverYear.thisYearLabel}`}>
              <YearOverYearPanel data={active.yearOverYear} />
            </Panel>
          )}

          {!isSingleCar && garageData.carComparison.length > 1 && (
            <Panel title="Which car is costing you more?">
              <Box sx={{ overflowX: "auto" }}>
                <Box
                  component="table"
                  sx={{
                    width: "100%",
                    minWidth: 560,
                    borderCollapse: "collapse",
                    fontSize: 13.5,
                    "& th, & td": { pr: 2, "&:last-of-type": { pr: 0 } },
                  }}
                >
                  <Box component="thead">
                    <Box component="tr">
                      {["Car", "₹/km", "Total spent", "Badge"].map((h) => (
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
                    {garageData.carComparison
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
                            {formatCurrency(car.totalSpend)}
                          </Box>
                          <Box component="td" sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
                            <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: "wrap" }}>
                              {badges?.mostExpensive === car.carId && (
                                <Chip size="small" color="error" label="Most expensive" />
                              )}
                              {badges?.bestFuelEconomy === car.carId && (
                                <Chip size="small" color="success" label="Best fuel economy" />
                              )}
                              {badges?.mostReliable === car.carId && (
                                <Chip size="small" color="success" label="Most reliable" />
                              )}
                            </Stack>
                          </Box>
                        </Box>
                      ))}
                  </Box>
                </Box>
              </Box>
            </Panel>
          )}
        </>
      )}

      <QuickAddExpenseDialog open={addExpenseOpen} onClose={() => setAddExpenseOpen(false)} />
    </Stack>
  );
}

// Mirrors the loaded layout (header, filters, stat cards, a chart panel) so
// the page doesn't jump when data arrives.
function AnalyticsSkeleton() {
  return (
    <Stack spacing={3} aria-busy="true">
      <Box>
        <Typography sx={{ fontSize: 27, fontWeight: 800 }}>Analytics</Typography>
        <Skeleton variant="text" width={240} sx={{ fontSize: 14, mt: 0.5 }} />
      </Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
        <Skeleton variant="rounded" width={180} height={40} />
        <Skeleton variant="rounded" width={160} height={40} />
      </Stack>
      <Grid container spacing={2}>
        {["Total spend", "Tracked", "Most expensive month"].map((label) => (
          <Grid key={label} size={{ xs: 12, sm: 4 }}>
            <StatCard value="" label={label} loading />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={320} sx={{ borderRadius: "14px" }} />
    </Stack>
  );
}
