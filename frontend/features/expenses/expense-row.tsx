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

export function ExpenseRow({
  expense,
  onClick,
  onDelete,
}: {
  expense: Expense;
  onClick: () => void;
  onDelete: () => void;
}) {
  const meta = categoryMeta(expense.category);

  return (
    <Stack
      direction="row"
      spacing={1.5}
      onClick={onClick}
      sx={{
        alignItems: "center",
        mx: 1,
        px: 1,
        py: 1.5,
        borderRadius: "10px",
        borderBottom: "1px solid",
        borderColor: "divider",
        cursor: "pointer",
        "&:last-of-type": { borderBottom: "none" },
        "&:hover": { bgcolor: "action.hover", borderColor: "transparent" },
      }}
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
        {expense.odometerKm != null && (
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            {expense.odometerKm.toLocaleString()} km
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right" }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
          {formatAmount(expense.amount, expense.currency)}
        </Typography>
        <Typography sx={{ fontSize: 11.5, color: "text.secondary" }}>
          {formatDate(expense.expenseDate)}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        sx={{ color: "text.secondary" }}
      >
        ✕
      </IconButton>
    </Stack>
  );
}
