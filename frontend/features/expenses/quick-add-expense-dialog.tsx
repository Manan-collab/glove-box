"use client";

import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useCars } from "@/hooks/use-cars";
import { useCreateExpense } from "@/hooks/use-expenses";
import { ExpenseFormDialog } from "./expense-form-dialog";

interface QuickAddExpenseDialogProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddExpenseDialog({ open, onClose }: QuickAddExpenseDialogProps) {
  const { data: cars } = useCars();
  const [carId, setCarId] = useState("");
  const createExpense = useCreateExpense(carId);

  const handleClose = () => {
    onClose();
    setCarId("");
  };

  const selectedCar = cars?.data.find((car) => car.id === carId);

  if (selectedCar) {
    return (
      <ExpenseFormDialog
        open={open}
        onClose={handleClose}
        title={`Add expense — ${selectedCar.year} ${selectedCar.make} ${selectedCar.model}`}
        isSubmitting={createExpense.isPending}
        error={createExpense.error?.message}
        onSubmit={(values) => {
          createExpense.mutate(values, { onSuccess: handleClose });
        }}
      />
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Which car?</DialogTitle>
      <DialogContent>
        {!cars || cars.data.length === 0 ? (
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
  );
}
