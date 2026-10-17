"use client";

import { useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";

// True below the `sm` breakpoint (600px). Used to open form dialogs full-screen
// on phones, where a floating dialog leaves too little room for the fields.
export function useIsPhone() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}
