"use client";

import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-auth";

export default function Home() {
  const router = useRouter();
  const { data, isLoading } = useMe();

  useEffect(() => {
    if (isLoading) return;
    router.replace(data ? "/dashboard" : "/login");
  }, [data, isLoading, router]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <CircularProgress />
    </Box>
  );
}
