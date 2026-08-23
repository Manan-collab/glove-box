"use client";

import { GoogleLogin } from "@react-oauth/google";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useGoogleLogin, useMe } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const googleLogin = useGoogleLogin();
  const [googleError, setGoogleError] = useState(false);

  useEffect(() => {
    if (me) {
      router.replace("/dashboard");
    }
  }, [me, router]);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#14161D",
        px: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 5,
          borderRadius: "18px",
          bgcolor: "#1C1F28",
          border: "1px solid #2B2E39",
        }}
      >
        <Stack spacing={3} sx={{ alignItems: "center", textAlign: "center" }}>
          <Typography sx={{ fontWeight: 800, fontSize: 21, letterSpacing: 0.5 }}>
            <Box component="span" sx={{ color: "#F2F3F7" }}>
              GLOVE
            </Box>
            <Box component="span" sx={{ color: "#5B8CFF" }}>
              BOX
            </Box>
          </Typography>

          <Stack spacing={1}>
            <Typography sx={{ fontWeight: 800, fontSize: 20, color: "#F2F3F7" }}>
              Your garage, signed in.
            </Typography>
            <Typography sx={{ fontSize: 13.5, color: "#A6A9B6" }}>
              One account. No passwords to remember.
            </Typography>
          </Stack>

          <Box sx={{ width: "100%", pt: 1, display: "flex", justifyContent: "center" }}>
            <GoogleLogin
              onSuccess={(credentialResponse) => {
                setGoogleError(false);
                if (!credentialResponse.credential) {
                  setGoogleError(true);
                  return;
                }
                googleLogin.mutate(credentialResponse.credential, {
                  onSuccess: () => router.push("/dashboard"),
                });
              }}
              onError={() => setGoogleError(true)}
              theme="filled_black"
              shape="pill"
              size="large"
              text="continue_with"
            />
          </Box>

          {(googleError || googleLogin.isError) && (
            <Alert severity="error" sx={{ width: "100%" }}>
              Sign-in failed. Please try again.
            </Alert>
          )}

          <Typography sx={{ fontSize: 13, color: "#6E7180" }}>
            By continuing, you agree to Glovebox&apos;s Terms &amp; Privacy Policy.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
