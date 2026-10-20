"use client";

import { TextField, type TextFieldProps } from "@mui/material";

// Unlike type="number", only digits (and one "." with `decimals`) get in:
// no letters, no minus sign.
export function NumberField({ decimals, onChange, ...props }: TextFieldProps & { decimals?: boolean }) {
  const pattern = decimals ? /^\d*\.?\d*$/ : /^\d*$/;
  return (
    <TextField
      {...props}
      value={props.value ?? ""}
      onChange={(event) => {
        if (pattern.test(event.target.value)) onChange?.(event);
      }}
      slotProps={{ ...props.slotProps, htmlInput: { inputMode: decimals ? "decimal" : "numeric" } }}
    />
  );
}
