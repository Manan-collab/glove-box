"use client";

import { Box, Stack, Typography } from "@mui/material";
import { Gauge, gaugeClasses } from "@mui/x-charts/Gauge";
import type { HealthScore } from "@/lib/car-facts";

function tierColor(score: number): "success.main" | "warning.main" | "error.main" {
  if (score >= 80) return "success.main";
  if (score >= 50) return "warning.main";
  return "error.main";
}

export function HealthGauge({ health }: { health: HealthScore }) {
  if (health.score == null) {
    return (
      <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
        Not enough data yet — log a service or set an insurance expiry date to see a health
        score for this car.
      </Typography>
    );
  }

  const color = tierColor(health.score);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={3} sx={{ alignItems: "center" }}>
      <Box sx={{ width: 160, height: 160, flexShrink: 0, position: "relative" }}>
        <Gauge
          value={health.score}
          valueMax={100}
          startAngle={-110}
          endAngle={110}
          sx={{
            [`& .${gaugeClasses.valueArc}`]: { fill: `var(--mui-palette-${color.replace(".", "-")})` },
            [`& .${gaugeClasses.valueText}`]: { fontSize: 32, fontWeight: 800 },
          }}
          text={({ value }) => `${value}`}
        />
        <Typography
          sx={{
            position: "absolute",
            left: "50%",
            bottom: "28%",
            transform: "translateX(-50%)",
            fontSize: 12,
            color: "text.secondary",
          }}
        >
          / 100
        </Typography>
      </Box>
      <Stack spacing={1.25} sx={{ flex: 1, width: "100%" }}>
        {health.components.map((component) => (
          <Box key={component.label}>
            <Stack direction="row" sx={{ justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{component.label}</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{component.score}/100</Typography>
            </Stack>
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{component.detail}</Typography>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}
