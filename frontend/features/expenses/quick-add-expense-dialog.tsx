"use client";

import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { QueryErrorState } from "@/features/shell/query-states";
import { useCars, useUpdateCar } from "@/hooks/use-cars";
import { useCreateExpense } from "@/hooks/use-expenses";
import { ExpenseFormDialog } from "./expense-form-dialog";

interface QuickAddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddExpenseDialog({ open, onClose }: QuickAddExpenseDialogProps) {
  const { data: cars, isLoading, isError, refetch, isFetching } = useCars();
  const [pickedCarId, setCarId] = useState("");
  // With a single car there's nothing to pick, so go straight to the form.
  const carId = pickedCarId || (cars?.data.length === 1 ? cars.data[0].id : "");
  const createExpense = useCreateExpense(carId);
  const updateCar = useUpdateCar(carId);

  const handleClose = () => {
    onClose();
    setCarId("");
    // Don't greet the next quick-add with the last attempt's error.
    createExpense.reset();
  };

  const selectedCar = cars?.data.find((car) => car.id === carId);

  // The insurance-expiry update runs alongside the expense save and can fail
  // after the form has already closed, so its error is reported out here.
  const insuranceErrorToast = (
    <Snackbar open={updateCar.isError} autoHideDuration={8000} onClose={() => updateCar.reset()}>
      <Alert severity="error" onClose={() => updateCar.reset()}>
        Couldn&apos;t update the car&apos;s insurance expiry: {updateCar.error?.message}
      </Alert>
    </Snackbar>
  );

  if (selectedCar) {
    return (
      <>
        <ExpenseFormDialog
          open={open}
          onClose={handleClose}
          title={`Add expense — ${selectedCar.year} ${selectedCar.make} ${selectedCar.model}`}
          isSubmitting={createExpense.isPending}
          error={createExpense.error?.message}
          onSubmit={(values) => {
            createExpense.mutate(values, { onSuccess: handleClose });
          }}
          onInsuranceExpiryDateSet={(date) => {
            updateCar.mutate({ insuranceExpiryDate: date });
          }}
        />
        {insuranceErrorToast}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>Which car?</DialogTitle>
        <DialogContent>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : isError && !cars ? (
            <QueryErrorState
              message="Couldn't load your cars."
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          ) : !cars || cars.data.length === 0 ? (
            <Alert severity="info">Add a car first before logging an expense.</Alert>
          ) : (
            <Box sx={{ pt: 0.5 }}>
              <Typography sx={{ fontSize: 13, color: "text.secondary", mb: 1.5 }}>
                Pick the car this expense belongs to.
              </Typography>
              <TextField
                select
                fullWidth
                label="Car"
                value={carId}
                onChange={(e) => setCarId(e.target.value)}
              >
                {cars.data.map((car) => (
                  <MenuItem key={car.id} value={car.id}>
                    {car.year} {car.make} {car.model}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}
        </DialogContent>
      </Dialog>
      {insuranceErrorToast}
    </>
  );
}
