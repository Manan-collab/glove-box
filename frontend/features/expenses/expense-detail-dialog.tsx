"use client";

import { Box, Button, Dialog, DialogActions, DialogContent, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { Expense } from "@/lib/expenses-api";
import { categoryAccent, categoryMeta } from "./expense-categories";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAmount(amount: string, currency: string) {
  const value = Number(amount);
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${value.toLocaleString()}`;
}

function Row({ label, value, isLast }: { label: string; value: string; isLast: boolean }) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: "space-between",
        py: 1.25,
        borderBottom: isLast ? "none" : "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography sx={{ fontSize: 13, color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{value}</Typography>
    </Stack>
  );
}

export function ExpenseDetailDialog({
  expense,
  onClose,
}: {
  expense: Expense | null;
  onClose: () => void;
}) {
  if (!expense) return null;
  const meta = categoryMeta(expense.category);
  const accent = categoryAccent(expense.category);

  const rows: { label: string; value: string }[] = [];
  if (expense.odometerKm != null) rows.push({ label: "Odometer", value: `${expense.odometerKm.toLocaleString()} km` });
  if (expense.litres) rows.push({ label: "Litres", value: `${Number(expense.litres)} L` });
  if (expense.fuelPricePerLitre) rows.push({ label: "Price / litre", value: `₹${Number(expense.fuelPricePerLitre)}` });
  if (expense.fuelStation) rows.push({ label: "Fuel station", value: expense.fuelStation });
  if (expense.workshopName) rows.push({ label: "Workshop", value: expense.workshopName });
  if (expense.workPerformed) rows.push({ label: "Work performed", value: expense.workPerformed });
  if (expense.whatBroke) rows.push({ label: "What broke", value: expense.whatBroke });
  if (expense.tyreBrand) rows.push({ label: "Brand / Model", value: expense.tyreBrand });
  if (expense.tyreSize) rows.push({ label: "Size", value: expense.tyreSize });

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        <Stack direction="row" spacing={1.75} sx={{ alignItems: "center", mb: 2.5 }}>
          <Box
            sx={(theme) => ({
              width: 48,
              height: 48,
              borderRadius: "13px",
              bgcolor: accent === "default" ? theme.palette.action.hover : alpha(theme.palette[accent].main, 0.16),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 21,
              flexShrink: 0,
            })}
          >
            {meta.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: accent === "default" ? "text.secondary" : `${accent}.main`,
              }}
            >
              {meta.label}
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>
              {formatAmount(expense.amount, expense.currency)}
            </Typography>
          </Box>
        </Stack>

        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: rows.length || expense.notes ? 2.5 : 0 }}>
          {formatDate(expense.expenseDate)}
        </Typography>

        {rows.length > 0 && (
          <Box
            sx={{
              bgcolor: "background.default",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "12px",
              px: 2,
              mb: expense.notes ? 2 : 0,
            }}
          >
            {rows.map((row, index) => (
              <Row key={row.label} label={row.label} value={row.value} isLast={index === rows.length - 1} />
            ))}
          </Box>
        )}

        {expense.notes && (
          <Box
            sx={{
              bgcolor: "background.default",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "12px",
              p: 2,
            }}
          >
            <Typography
              sx={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "text.secondary",
                mb: 0.5,
              }}
            >
              Notes
            </Typography>
            <Typography sx={{ fontSize: 13.5 }}>{expense.notes}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
