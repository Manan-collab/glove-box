"use client";

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CarFormDialog } from "@/features/cars/car-form-dialog";
import { carGradient } from "@/features/cars/car-gradient";
import { ExpenseFormDialog } from "@/features/expenses/expense-form-dialog";
import { ExpenseRow } from "@/features/expenses/expense-row";
import { timeAgo } from "@/lib/time-ago";
import type { Expense } from "@/lib/expenses-api";
import { useCar, useDeleteCar, useUpdateCar } from "@/hooks/use-cars";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from "@/hooks/use-expenses";

export default function CarDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: car, isLoading, isError } = useCar(params.id);
  const updateCar = useUpdateCar(params.id);
  const deleteCar = useDeleteCar();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: expensesPage, isLoading: expensesLoading } = useExpenses(params.id);
  const createExpense = useCreateExpense(params.id);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const updateExpense = useUpdateExpense(params.id, editingExpense?.id ?? "");
  const deleteExpense = useDeleteExpense(params.id);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !car) {
    return <Alert severity="error">Car not found.</Alert>;
  }

  const expenses = expensesPage?.data ?? [];

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Button
        onClick={() => router.push("/dashboard")}
        sx={{ alignSelf: "flex-start", color: "text.secondary" }}
      >
        ← Back to garage
      </Button>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.75} sx={{ alignItems: "flex-start" }}>
        <Box
          sx={{
            width: { xs: "100%", sm: 260 },
            height: 170,
            borderRadius: "14px",
            flexShrink: 0,
            background: carGradient(car.id),
          }}
        />
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800 }}>
            {car.year} {car.make} {car.model}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13.5, mt: 0.5 }}>
            {car.variant} · {car.engine} · {car.transmission}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mt: 1.5 }}>
            <Chip size="small" label={car.fuelType} />
            <Chip size="small" label={car.bodyType} />
            {car.powerBhp && <Chip size="small" label={`${car.powerBhp} bhp`} />}
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ mt: 2 }}>
            <Button variant="contained" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button color="error" onClick={() => setConfirmDeleteOpen(true)}>
              Delete
            </Button>
          </Stack>
        </Box>
      </Stack>

      <Stack spacing={1} sx={{ pt: 1 }}>
        <DetailRow label="Odometer" value={`${car.odometerKm.toLocaleString()} km`} />
        <DetailRow label="VIN" value={car.vin ?? "—"} />
        <DetailRow label="Added" value={timeAgo(car.createdAt)} />
      </Stack>

      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "14px",
          p: 2.5,
        }}
      >
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Expenses</Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setEditingExpense(null);
              setExpenseFormOpen(true);
            }}
          >
            + Expense
          </Button>
        </Stack>

        {expensesLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!expensesLoading && expenses.length === 0 && (
          <Typography sx={{ fontSize: 13.5, color: "text.secondary", py: 1 }}>
            No expenses logged yet.
          </Typography>
        )}

        {expenses.map((expense) => (
          <ExpenseRow
            key={expense.id}
            expense={expense}
            onClick={() => {
              setEditingExpense(expense);
              setExpenseFormOpen(true);
            }}
            onDelete={() => setDeletingExpenseId(expense.id)}
          />
        ))}
      </Box>

      <CarFormDialog
        key={car.updatedAt}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit car"
        isSubmitting={updateCar.isPending}
        error={updateCar.error?.message}
        defaultValues={{
          make: car.make,
          model: car.model,
          year: car.year,
          variant: car.variant,
          vin: car.vin ?? "",
          engine: car.engine,
          fuelType: car.fuelType,
          transmission: car.transmission,
          bodyType: car.bodyType,
          powerBhp: car.powerBhp ?? undefined,
          odometerKm: car.odometerKm,
        }}
        onSubmit={(values) => {
          updateCar.mutate(values, { onSuccess: () => setEditOpen(false) });
        }}
      />

      <ExpenseFormDialog
        key={editingExpense?.id ?? "new"}
        open={expenseFormOpen}
        onClose={() => setExpenseFormOpen(false)}
        title={editingExpense ? "Edit expense" : "What did you spend on?"}
        isSubmitting={editingExpense ? updateExpense.isPending : createExpense.isPending}
        error={(editingExpense ? updateExpense.error : createExpense.error)?.message}
        defaultValues={
          editingExpense
            ? {
                category: editingExpense.category,
                amount: Number(editingExpense.amount),
                expenseDate: editingExpense.expenseDate,
                odometerKm: editingExpense.odometerKm ?? undefined,
                notes: editingExpense.notes ?? "",
                workshopName: editingExpense.workshopName ?? "",
                workPerformed: editingExpense.workPerformed ?? "",
                whatBroke: editingExpense.whatBroke ?? "",
                litres: editingExpense.litres ? Number(editingExpense.litres) : undefined,
                fuelPricePerLitre: editingExpense.fuelPricePerLitre
                  ? Number(editingExpense.fuelPricePerLitre)
                  : undefined,
                fuelStation: editingExpense.fuelStation ?? "",
                tyreBrand: editingExpense.tyreBrand ?? "",
                tyreSize: editingExpense.tyreSize ?? "",
              }
            : undefined
        }
        onSubmit={(values) => {
          if (editingExpense) {
            updateExpense.mutate(values, { onSuccess: () => setExpenseFormOpen(false) });
          } else {
            createExpense.mutate(values, { onSuccess: () => setExpenseFormOpen(false) });
          }
        }}
      />

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Delete this car?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This removes {car.year} {car.make} {car.model} permanently. This can&apos;t be
            undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteCar.isPending}
            onClick={() => {
              deleteCar.mutate(car.id, {
                onSuccess: () => router.push("/dashboard"),
              });
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deletingExpenseId} onClose={() => setDeletingExpenseId(null)}>
        <DialogTitle>Delete this expense?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">This can&apos;t be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingExpenseId(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteExpense.isPending}
            onClick={() => {
              if (!deletingExpenseId) return;
              deleteExpense.mutate(deletingExpenseId, {
                onSuccess: () => setDeletingExpenseId(null),
              });
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={2}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 120 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}
