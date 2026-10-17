import { Box, Button, Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { PublicFooter, PublicHeader } from "@/features/marketing/public-shell";

export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn't exist or has moved.",
};

export default function NotFound() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <PublicHeader showSignIn={false} />
      <Box
        component="main"
        sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 2, py: 8 }}
      >
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center", maxWidth: 440 }}>
          <Typography
            aria-hidden="true"
            sx={{
              fontWeight: 800,
              fontSize: { xs: 72, md: 96 },
              lineHeight: 1,
              letterSpacing: -3,
              color: "primary.main",
              fontFamily: "var(--font-jetbrains-mono), monospace",
            }}
          >
            404
          </Typography>
          <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: 24, md: 28 } }}>
            This road doesn&apos;t go anywhere
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 15.5 }}>
            The page you&apos;re looking for doesn&apos;t exist or has moved. Check the address, or head back to your
            garage.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1, width: { xs: "100%", sm: "auto" } }}>
            <Button href="/dashboard" variant="contained" size="large">
              Go to my garage
            </Button>
            <Button href="/" variant="outlined" size="large">
              Home
            </Button>
          </Stack>
        </Stack>
      </Box>
      <PublicFooter />
    </Box>
  );
}
