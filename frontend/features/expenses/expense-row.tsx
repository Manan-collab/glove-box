"use client";

import { Box, IconButton, Stack, Typography } from "@mui/material";
import type { Expense } from "@/lib/expenses-api";
import { categoryMeta } from "./expense-categories";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatAmount(amount: string, currency: string) {
  const value = Number(amount);
  const symbol = currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${value.toLocaleString()}`;
}

// A short, category-specific second line so a row says more than just its
// category — falls back to odometer, then notes, then nothing.
export function expenseSubtitle(expense: Expense): string | null {
  switch (expense.category) {
    case "FUEL": {
      const parts: string[] = [];
      if (expense.litres) parts.push(`${Number(expense.litres)} L`);
      if (expense.fuelPricePerLitre) parts.push(`₹${Number(expense.fuelPricePerLitre)}/L`);
      if (expense.fuelStation) parts.push(expense.fuelStation);
      if (parts.length > 0) return parts.join(" · ");
      break;
    }
    case "SERVICE": {
      const parts = [expense.workshopName, expense.workPerformed].filter(Boolean);
      if (parts.length > 0) return parts.join(" — ");
      break;
    }
    case "REPAIR": {
      const parts = [expense.whatBroke, expense.workshopName].filter(Boolean);
      if (parts.length > 0) return parts.join(" — ");
      break;
    }
    case "TYRES": {
      const parts = [expense.tyreBrand, expense.tyreSize].filter(Boolean);
      if (parts.length > 0) return parts.join(" · ");
      break;
    }
  }
  if (expense.odometerKm != null) return `${expense.odometerKm.toLocaleString()} km`;
  if (expense.notes) return expense.notes;
  return null;
}

export function ExpenseRow({
  expense,
  onView,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = categoryMeta(expense.category);
  const subtitle = expenseSubtitle(expense);

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        mx: 1,
        px: 1,
        py: 1.5,
        borderRadius: "10px",
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
        "&:hover": { bgcolor: "action.hover", borderColor: "transparent" },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        onClick={onView}
        sx={{ alignItems: "center", flex: 1, minWidth: 0, cursor: "pointer" }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: "9px",
            bgcolor: "background.default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{meta.label}</Typography>
          {subtitle && (
            <Typography
              sx={{
                fontSize: 12,
                color: "text.secondary",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
            {formatAmount(expense.amount, expense.currency)}
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
            {formatDate(expense.expenseDate)}
          </Typography>
        </Box>
      </Stack>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        sx={{ color: "text.secondary" }}
        aria-label="Edit expense"
      >
        ✏️
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        sx={{ color: "text.secondary" }}
        aria-label="Delete expense"
      >
        ✕
      </IconButton>
    </Stack>
  );
}
