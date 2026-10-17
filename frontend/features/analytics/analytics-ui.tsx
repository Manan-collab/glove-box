"use client";

import { Box, Skeleton, Stack, Typography } from "@mui/material";
import { categoryMeta, type ExpenseCategory } from "@/features/expenses/expense-categories";
import { formatCurrency } from "@/lib/format-currency";

export function StatCard({
  value,
  label,
  accent,
  loading,
}: {
  value: string;
  label: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <Box
      sx={(theme) => ({
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        p: "20px 22px",
        boxShadow: "none",
        ...theme.applyStyles("light", { boxShadow: "0 1px 2px rgba(30, 41, 82, 0.06)" }),
      })}
    >
      {loading ? (
        <Skeleton variant="text" width={100} height={38} />
      ) : (
        <Typography sx={{ fontSize: 26, fontWeight: 800, color: accent ? "primary.main" : "text.primary" }}>
          {value}
        </Typography>
      )}
      <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}

export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={(theme) => ({
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        p: "20px 22px",
        height: "100%",
        boxShadow: "none",
        ...theme.applyStyles("light", { boxShadow: "0 1px 2px rgba(30, 41, 82, 0.06)" }),
      })}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}

// Shared placeholder for a panel's body while its own query is still loading
// (as opposed to the page-level loading gate) — shaped like the icon + two
// lines + amount rows most panels render.
export function PanelLoading({ rows = 3 }: { rows?: number }) {
  return (
    <Stack spacing={0} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Stack key={index} direction="row" spacing={1.5} sx={{ alignItems: "center", py: 1.25 }}>
          <Skeleton variant="rounded" width={34} height={34} sx={{ borderRadius: "9px", flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="45%" sx={{ fontSize: 13.5 }} />
            <Skeleton variant="text" width="30%" sx={{ fontSize: 12 }} />
          </Box>
          <Skeleton variant="text" width={64} sx={{ fontSize: 13.5 }} />
        </Stack>
      ))}
    </Stack>
  );
}

export function CategoryBreakdownBars({
  rows,
}: {
  rows: { category: ExpenseCategory; total: number }[];
}) {
  const maxTotal = Math.max(...rows.map((row) => row.total), 1);

  return (
    <Stack spacing={1.5}>
      {rows
        .slice()
        .sort((a, b) => b.total - a.total)
        .map((row) => {
          const meta = categoryMeta(row.category);
          return (
            <Stack key={row.category} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
              <Typography sx={{ fontSize: 13, width: 90, flexShrink: 0 }}>
                <span aria-hidden="true">{meta.icon}</span> {meta.label}
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
                    width: `${(row.total / maxTotal) * 100}%`,
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
  );
}
