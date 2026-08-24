"use client";

import { Box, Typography } from "@mui/material";

export function StatCard({
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
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "14px",
        p: "20px 22px",
        height: "100%",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{title}</Typography>
        {action}
      </Box>
      {children}
    </Box>
  );
}
