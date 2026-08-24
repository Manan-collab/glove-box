"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: "data" },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: "var(--font-inter), 'Inter', sans-serif",
  },
  colorSchemes: {
    light: {
      palette: {
        background: { default: "#EBEEF8", paper: "#FFFFFF" },
        text: { primary: "#181A2A", secondary: "#5B5E6B", disabled: "#9497A3" },
        divider: "#DBDFEC",
        primary: { main: "#2F6BFF", dark: "#1E52D6", contrastText: "#FFFFFF" },
        success: { main: "#1B9A66" },
        warning: { main: "#C98A1F" },
        error: { main: "#D5454C" },
      },
    },
    dark: {
      palette: {
        background: { default: "#14161D", paper: "#1C1F28" },
        text: { primary: "#F2F3F7", secondary: "#A6A9B6", disabled: "#6E7180" },
        divider: "#2B2E39",
        primary: { main: "#5B8CFF", dark: "#7FA3FF", contrastText: "#FFFFFF" },
        success: { main: "#33D690" },
        warning: { main: "#F2B84E" },
        error: { main: "#F16A70" },
      },
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: "none",
          ...theme.applyStyles("light", { boxShadow: "0 1px 2px rgba(30, 41, 82, 0.06)" }),
        }),
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme, ownerState }) => ({
          ...(ownerState.variant === "outlined" && {
            borderColor: theme.palette.divider,
          }),
        }),
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600, borderRadius: 9 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: { padding: "20px 24px" },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        // Matches DialogContent's 24px horizontal padding so Cancel/Save
        // line up with the form fields above instead of hugging the edge.
        root: { padding: "16px 24px 24px" },
      },
    },
  },
});
