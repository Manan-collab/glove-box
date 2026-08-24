"use client";

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { Expense } from "@/lib/expenses-api";
import { categoryMeta } from "./expense-categories";

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", py: 0.75 }}>
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
      <DialogTitle>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "9px",
              bgcolor: "background.default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {meta.icon}
          </Box>
          {meta.label}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 28, fontWeight: 800, mt: 0.5 }}>
          {formatAmount(expense.amount, expense.currency)}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 2 }}>
          {formatDate(expense.expenseDate)}
        </Typography>

        {rows.length > 0 && (
          <Stack sx={{ borderTop: "1px solid", borderColor: "divider" }}>
            {rows.map((row) => (
              <Row key={row.label} label={row.label} value={row.value} />
            ))}
          </Stack>
        )}

        {expense.notes && (
          <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: 12, color: "text.secondary", mb: 0.5 }}>Notes</Typography>
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
