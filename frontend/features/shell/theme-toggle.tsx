"use client";

import { useColorScheme } from "@mui/material/styles";
import { ButtonGroup, Button } from "@mui/material";

const OPTIONS = [
  { mode: "light" as const, label: "☀️" },
  { mode: "dark" as const, label: "🌙" },
];

export function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();
  // Visitors who picked the old "system" option still have it saved —
  // highlight whichever scheme it currently resolves to.
  const activeMode = mode === "system" ? systemMode : mode;

  return (
    <ButtonGroup size="small" variant="outlined">
      {OPTIONS.map((option) => (
        <Button
          key={option.mode}
          variant={activeMode === option.mode ? "contained" : "outlined"}
          onClick={() => setMode(option.mode)}
          sx={{ minWidth: 36, px: 1 }}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
}
