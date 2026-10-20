"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { NumberField } from "@/features/shell/number-field";
import { useIsPhone } from "@/hooks/use-is-phone";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import type { ExpenseFormValues } from "@/lib/expenses-api";
import { EXPENSE_CATEGORIES } from "./expense-categories";
import { type ExpenseFormSchema, expenseFormSchema } from "./expense-form-schema";

type ExpenseFormInput = z.input<typeof expenseFormSchema>;

interface ExpenseFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: ExpenseFormValues) => void;
  isSubmitting: boolean;
  error?: string;
  title: string;
  defaultValues?: Partial<ExpenseFormSchema>;
  // Called separately from onSubmit when an INSURANCE expense sets an
  // expiry date — that date belongs on the car, not the expense record.
  onInsuranceExpiryDateSet?: (date: string) => void;
}

function toISODate(value: string) {
  return value ? new Date(value).toISOString() : value;
}

function fromISODate(value?: string) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

export function ExpenseFormDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  title,
  defaultValues,
  onInsuranceExpiryDateSet,
}: ExpenseFormDialogProps) {
  const isPhone = useIsPhone();
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ExpenseFormInput, unknown, ExpenseFormSchema>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: {
      category: "FUEL",
      amount: "",
      expenseDate: fromISODate(defaultValues?.expenseDate),
      notes: "",
      workshopName: "",
      workPerformed: "",
      whatBroke: "",
      fuelStation: "",
      tyreBrand: "",
      tyreSize: "",
      insuranceExpiryDate: "",
      ...defaultValues,
      ...(defaultValues?.expenseDate && {
        expenseDate: fromISODate(defaultValues.expenseDate),
      }),
    },
  });

  const category = useWatch({ control, name: "category" });

  const submit = handleSubmit((values) => {
    const { insuranceExpiryDate, ...expenseValues } = values;
    onSubmit({
      ...expenseValues,
      expenseDate: toISODate(values.expenseDate),
      notes: values.notes || undefined,
      workshopName: values.workshopName || undefined,
      workPerformed: values.workPerformed || undefined,
      whatBroke: values.whatBroke || undefined,
      fuelStation: values.fuelStation || undefined,
      tyreBrand: values.tyreBrand || undefined,
      tyreSize: values.tyreSize || undefined,
    });
    if (insuranceExpiryDate) {
      onInsuranceExpiryDateSet?.(insuranceExpiryDate);
    }
  });

  return (
    <Dialog
      open={open}
      // Closing mid-save would hide the outcome, including an error.
      onClose={isSubmitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      fullScreen={isPhone}
      slotProps={{ transition: { onExited: () => reset() } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography
          id="expense-category-label"
          sx={{ fontSize: 12.5, fontWeight: 600, color: "text.secondary", mb: 1 }}
        >
          Category
        </Typography>
        {/* Each tile is a label around a visually hidden native radio, so the
            browser handles keyboard use (Tab into the group, arrow keys to
            move, selection follows focus) and screen readers announce it as a
            radio group. */}
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Grid
              container
              spacing={1}
              role="radiogroup"
              aria-labelledby="expense-category-label"
              sx={{ mb: 2 }}
            >
              {EXPENSE_CATEGORIES.map((cat) => {
                const selected = field.value === cat.value;
                return (
                  <Grid key={cat.value} size={{ xs: 4, sm: 3 }}>
                    <Box
                      component="label"
                      sx={{
                        position: "relative",
                        border: "1px solid",
                        borderColor: selected ? "primary.main" : "divider",
                        bgcolor: selected ? "action.selected" : "background.default",
                        color: selected ? "primary.main" : "text.primary",
                        borderRadius: "10px",
                        py: 1.25,
                        px: 0.5,
                        textAlign: "center",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 600,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 0.5,
                        "&:has(input:focus-visible)": {
                          outline: "2px solid",
                          outlineColor: "primary.main",
                          outlineOffset: 2,
                        },
                      }}
                    >
                      <Box
                        component="input"
                        type="radio"
                        name={field.name}
                        value={cat.value}
                        checked={selected}
                        onChange={() => field.onChange(cat.value)}
                        onBlur={field.onBlur}
                        disabled={isSubmitting}
                        sx={{
                          position: "absolute",
                          width: 1,
                          height: 1,
                          m: 0,
                          p: 0,
                          overflow: "hidden",
                          clipPath: "inset(50%)",
                          whiteSpace: "nowrap",
                          border: 0,
                        }}
                      />
                      <Box component="span" aria-hidden="true" sx={{ fontSize: 19 }}>
                        {cat.icon}
                      </Box>
                      {cat.label}
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        />

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <NumberField
                  {...field}
                  decimals
                  label="Amount"
                  placeholder="0"
                  fullWidth
                  error={!!errors.amount}
                  helperText={errors.amount?.message}
                  slotProps={{
                    input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> },
                  }}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="expenseDate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Date"
                  fullWidth
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.expenseDate}
                  helperText={errors.expenseDate?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="odometerKm"
              control={control}
              render={({ field }) => (
                <NumberField
                  {...field}
                  label="Odometer (km)"
                  fullWidth
                  error={!!errors.odometerKm}
                  helperText={errors.odometerKm?.message ?? "Optional"}
                />
              )}
            />
          </Grid>

          {category === "FUEL" && (
            <>
              <Grid size={{ xs: 6 }}>
                <Controller
                  name="litres"
                  control={control}
                  render={({ field }) => (
                    <NumberField
                      {...field}
                      decimals
                      label="Litres"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Controller
                  name="fuelPricePerLitre"
                  control={control}
                  render={({ field }) => (
                    <NumberField
                      {...field}
                      decimals
                      label="Price / litre"
                      fullWidth
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="fuelStation"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Fuel station" fullWidth />
                  )}
                />
              </Grid>
            </>
          )}

          {(category === "SERVICE" || category === "REPAIR") && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="workshopName"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Workshop" fullWidth />
                )}
              />
            </Grid>
          )}
          {category === "SERVICE" && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="workPerformed"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="Work performed" fullWidth />
                )}
              />
            </Grid>
          )}
          {category === "REPAIR" && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="whatBroke"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="What broke?" fullWidth />
                )}
              />
            </Grid>
          )}

          {category === "TYRES" && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="tyreBrand"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Brand / Model" fullWidth />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="tyreSize"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} label="Size" fullWidth />
                  )}
                />
              </Grid>
            </>
          )}

          {category === "INSURANCE" && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="insuranceExpiryDate"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ""}
                    type="date"
                    label="Insurance expiry"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    helperText="Updates the car's insurance expiry too"
                  />
                )}
              />
            </Grid>
          )}

          <Grid size={12}>
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Notes (optional)" fullWidth multiline minRows={2} />
              )}
            />
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} loading={isSubmitting}>
          Save Expense
        </Button>
      </DialogActions>
    </Dialog>
  );
}
