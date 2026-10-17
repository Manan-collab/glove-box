"use client";

import { Alert, Button, Stack, Typography } from "@mui/material";
import Link from "next/link";
import { ApiError } from "@/lib/api-client";

// A 404 (gone) and a 403 (exists but isn't yours / not your friend) both read
// as "not found" to the user — neither is fixed by retrying.
export function isNotFoundError(error: unknown) {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

export function QueryErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <Alert
      severity="error"
      action={
        <Button color="inherit" size="small" loading={retrying} onClick={onRetry}>
          Retry
        </Button>
      }
    >
      {message}
    </Alert>
  );
}

export function NotFoundState({
  title,
  message,
  backHref,
  backLabel,
}: {
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: "center", textAlign: "center", py: 6 }}>
      <Typography component="h1" sx={{ fontSize: 21, fontWeight: 800 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: 14, color: "text.secondary", maxWidth: 420 }}>{message}</Typography>
      <Button variant="outlined" component={Link} href={backHref}>
        {backLabel}
      </Button>
    </Stack>
  );
}
