"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  TextField,
} from "@mui/material";
import { NumberField } from "@/features/shell/number-field";
import { useIsPhone } from "@/hooks/use-is-phone";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import type { CarFormValues } from "@/lib/cars-api";
import {
  getBodyTypeFor,
  getMakeNames,
  getModelNames,
  getVariantNames,
  type GlobalCatalog,
  loadGlobalCatalog,
} from "@/lib/vehicle-catalog";
import {
  BODY_TYPES,
  CAR_USAGE_TAGS,
  type CarFormSchema,
  carFormSchema,
  FUEL_TYPES,
  TRANSMISSIONS,
} from "./car-form-schema";

type CarFormInput = z.input<typeof carFormSchema>;

function fromISODate(value?: string) {
  return value ? value.slice(0, 10) : "";
}

interface CarFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CarFormValues) => void;
  isSubmitting: boolean;
  error?: string;
  title: string;
  defaultValues?: Partial<CarFormSchema>;
}

export function CarFormDialog({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  title,
  defaultValues,
}: CarFormDialogProps) {
  const isPhone = useIsPhone();
  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CarFormInput, unknown, CarFormSchema>({
    resolver: zodResolver(carFormSchema),
    defaultValues: {
      make: "",
      model: "",
      year: new Date().getFullYear(),
      variant: "",
      vin: "",
      engine: "",
      fuelType: "",
      transmission: "",
      bodyType: "",
      odometerKm: "",
      usageTag: "",
      insuranceExpiryDate: "",
      ...defaultValues,
      ...(defaultValues?.insuranceExpiryDate && {
        insuranceExpiryDate: fromISODate(defaultValues.insuranceExpiryDate),
      }),
    },
  });

  const [globalCatalog, setGlobalCatalog] = useState<GlobalCatalog | undefined>();
  useEffect(() => {
    let cancelled = false;
    loadGlobalCatalog()
      .then((data) => {
        if (!cancelled) setGlobalCatalog(data);
      })
      .catch(() => {
        // Worldwide catalog is a convenience layer — the curated list and
        // free text both keep working if this fetch fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const make = useWatch({ control, name: "make" });
  const model = useWatch({ control, name: "model" });
  const makeOptions = getMakeNames(globalCatalog);
  const modelOptions = getModelNames(make ?? "", globalCatalog);
  const variantOptions = getVariantNames(make ?? "", model ?? "");

  const submit = handleSubmit((values) => {
    onSubmit({
      ...values,
      vin: values.vin || undefined,
      powerBhp: values.powerBhp || undefined,
      usageTag: values.usageTag || undefined,
      insuranceExpiryDate: values.insuranceExpiryDate || undefined,
    });
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
        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="make"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  freeSolo
                  options={makeOptions}
                  value={value}
                  onChange={(_, newValue) => onChange(newValue ?? "")}
                  onInputChange={(_, newInputValue) => onChange(newInputValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Make"
                      fullWidth
                      error={!!errors.make}
                      helperText={errors.make?.message}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="model"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  freeSolo
                  options={modelOptions}
                  value={value}
                  onChange={(_, newValue) => {
                    onChange(newValue ?? "");
                    const bodyType = getBodyTypeFor(make ?? "", newValue ?? "");
                    if (bodyType) {
                      setValue("bodyType", bodyType, { shouldValidate: true });
                    }
                  }}
                  onInputChange={(_, newInputValue) => onChange(newInputValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Model"
                      fullWidth
                      error={!!errors.model}
                      helperText={errors.model?.message}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="year"
              control={control}
              render={({ field }) => (
                <NumberField
                  {...field}
                  label="Year"
                  fullWidth
                  error={!!errors.year}
                  helperText={errors.year?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="variant"
              control={control}
              render={({ field: { onChange, value } }) => (
                <Autocomplete
                  freeSolo
                  options={variantOptions}
                  value={value}
                  onChange={(_, newValue) => onChange(newValue ?? "")}
                  onInputChange={(_, newInputValue) => onChange(newInputValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Variant"
                      fullWidth
                      error={!!errors.variant}
                      helperText={errors.variant?.message}
                    />
                  )}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="fuelType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Fuel type"
                  fullWidth
                  error={!!errors.fuelType}
                  helperText={errors.fuelType?.message}
                >
                  {FUEL_TYPES.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="transmission"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Transmission"
                  fullWidth
                  error={!!errors.transmission}
                  helperText={errors.transmission?.message}
                >
                  {TRANSMISSIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="bodyType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Body type"
                  fullWidth
                  error={!!errors.bodyType}
                  helperText={errors.bodyType?.message}
                >
                  {BODY_TYPES.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="engine"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Engine"
                  placeholder="e.g. 1.8L i-VTEC"
                  fullWidth
                  error={!!errors.engine}
                  helperText={errors.engine?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="powerBhp"
              control={control}
              render={({ field }) => (
                <NumberField
                  {...field}
                  label="Power (bhp)"
                  fullWidth
                  error={!!errors.powerBhp}
                  helperText={errors.powerBhp?.message}
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
                  placeholder="0"
                  fullWidth
                  error={!!errors.odometerKm}
                  helperText={errors.odometerKm?.message}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="vin"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  label="VIN"
                  fullWidth
                  error={!!errors.vin}
                  helperText={errors.vin?.message ?? "Optional"}
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Controller
              name="usageTag"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value ?? ""}
                  select
                  label="Usage"
                  fullWidth
                  helperText="Optional"
                >
                  <MenuItem value="">None</MenuItem>
                  {CAR_USAGE_TAGS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Grid>
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
                  helperText="Optional"
                />
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
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
