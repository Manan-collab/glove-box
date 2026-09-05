"use client";

import { useColorScheme } from "@mui/material/styles";
import { ButtonGroup, Button } from "@mui/material";

const OPTIONS = [
  { mode: "light" as const, label: "☀️" },
  { mode: "system" as const, label: "⚙️" },
  { mode: "dark" as const, label: "🌙" },
];

export function ThemeToggle() {
  const { mode, setMode } = useColorScheme();

  return (
    <ButtonGroup size="small" variant="outlined">
      {OPTIONS.map((option) => (
        <Button
          key={option.mode}
          variant={mode === option.mode ? "contained" : "outlined"}
          onClick={() => setMode(option.mode)}
          sx={{ minWidth: 36, px: 1 }}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
