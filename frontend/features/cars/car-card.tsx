"use client";

import { Box, Card, Stack, Typography } from "@mui/material";
import Link from "next/link";
import type { Car } from "@/lib/cars-api";
import { carGradient } from "./car-gradient";
import { timeAgo } from "@/lib/time-ago";

export function CarCard({ car }: { car: Car }) {
  return (
    <Card
      component={Link}
      href={`/dashboard/cars/${car.id}`}
      sx={{
        display: "block",
        p: 1.75,
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        overflow: "hidden",
        border: "none",
        transition: "box-shadow .2s, transform .2s",
        "&:hover": {
          boxShadow: "0 14px 32px -18px rgba(20,20,30,0.4)",
          transform: "translateY(-3px)",
        },
        "&:hover .car-hover-reveal": { opacity: 1, transform: "translateY(0)" },
      }}
    >
      <Box
        sx={{
          height: 150,
          borderRadius: "10px",
          position: "relative",
          overflow: "hidden",
          background: carGradient(car.id),
        }}
      >
        <Box
          component="span"
          sx={{
            position: "absolute",
            bottom: 10,
            left: 10,
            fontFamily: "var(--font-jetbrains-mono), monospace",
            fontSize: 9.5,
            letterSpacing: "0.06em",
            color: "rgba(255,255,255,0.7)",
            bgcolor: "rgba(0,0,0,0.28)",
            px: 0.9,
            py: 0.4,
            borderRadius: "5px",
          }}
        >
          {car.variant}
        </Box>
      </Box>

      <Typography sx={{ fontSize: 15.5, fontWeight: 700, mt: 1.5 }}>
        {car.year} {car.make} {car.model}
      </Typography>
      <Typography sx={{ fontSize: 12.5, color: "text.secondary", mt: 0.25 }}>
        {car.fuelType} · {car.transmission}
      </Typography>

      <Stack direction="row" sx={{ justifyContent: "space-between", mt: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
            {car.odometerKm.toLocaleString()} km
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: "text.secondary" }}>
            Odometer
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
            {car.powerBhp ? `${car.powerBhp} bhp` : car.bodyType}
          </Typography>
          <Typography sx={{ fontSize: 11, fontWeight: 500, color: "text.secondary" }}>
            {car.powerBhp ? "Power" : "Body type"}
          </Typography>
        </Box>
      </Stack>

      <Box
        className="car-hover-reveal"
        sx={{
          position: "absolute",
          inset: 0,
          bgcolor: "rgba(10,12,20,0.92)",
          color: "#fff",
          p: 2.5,
          display: { xs: "none", sm: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          gap: 1.25,
          opacity: 0,
          transform: "translateY(6px)",
          transition: "all .2s",
          pointerEvents: "none",
        }}
      >
        <HoverRow label="Engine" value={car.engine} />
        {car.vin && <HoverRow label="VIN" value={car.vin} />}
        <HoverRow label="Added" value={timeAgo(car.createdAt)} />
        <Typography sx={{ mt: "auto", fontWeight: 700, fontSize: 12.5, color: "primary.dark" }}>
          Open garage →
        </Typography>
      </Box>
    </Card>
  );
}

function HoverRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack
      direction="row"
      sx={{
        justifyContent: "space-between",
        fontSize: 12.5,
        borderBottom: "1px solid rgba(255,255,255,0.14)",
        pb: 1,
        "&:last-of-type": { borderBottom: "none", pb: 0 },
      }}
    >
      <Box component="span" sx={{ color: "rgba(255,255,255,0.55)" }}>
        {label}
      </Box>
      <Box component="span">{value}</Box>
    </Stack>
  );
}
