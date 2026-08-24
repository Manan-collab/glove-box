"use client";

import { Chip, Stack, Typography } from "@mui/material";
import { categoryMeta } from "@/features/expenses/expense-categories";
import type { YearOverYear } from "@/lib/analytics-api";
import { formatCurrency } from "@/lib/format-currency";

function ChangeChip({ percentChange }: { percentChange: number | null }) {
  if (percentChange == null) {
    return (
      <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>New this year</Typography>
    );
  }
  // Spending going down is the good direction, so a decrease is green and
  // an increase is red — the opposite of a typical "up is good" stat.
  const isIncrease = percentChange > 0;
  return (
    <Chip
      size="small"
      color={isIncrease ? "error" : "success"}
      label={`${isIncrease ? "↑" : "↓"} ${Math.abs(percentChange)}%`}
    />
  );
}

export function YearOverYearPanel({ data }: { data: YearOverYear }) {
  return (
    <Stack spacing={1.5}>
      {data.categories.map((row) => {
        const meta = categoryMeta(row.category);
        return (
          <Stack
            key={row.category}
            direction="row"
            sx={{ justifyContent: "space-between", alignItems: "center" }}
          >
            <Typography sx={{ fontSize: 13.5 }}>
              {meta.icon} {meta.label}
            </Typography>
            <ChangeChip percentChange={row.percentChange} />
          </Stack>
        );
      })}
      <Stack
        direction="row"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          pt: 1.25,
          mt: 0.25,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Total cost</Typography>
        <ChangeChip percentChange={data.totalPercentChange} />
      </Stack>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {data.lastYearLabel}: {formatCurrency(data.totalLastYear)}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {data.thisYearLabel}: {formatCurrency(data.totalThisYear)}
        </Typography>
      </Stack>
    </Stack>
  );
}
