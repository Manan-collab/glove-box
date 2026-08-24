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
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AddNoteDialog } from "@/features/cars/add-note-dialog";
import { CarFormDialog } from "@/features/cars/car-form-dialog";
import { carGradient } from "@/features/cars/car-gradient";
import { CategoryBreakdownBars, Panel, PanelLoading, StatCard } from "@/features/analytics/analytics-ui";
import { DataIoDialog } from "@/features/data-io/data-io-dialog";
import { EXPENSE_CATEGORIES } from "@/features/expenses/expense-categories";
import type { ExpenseCategory } from "@/features/expenses/expense-categories";
import { ExpenseDetailDialog } from "@/features/expenses/expense-detail-dialog";
import { ExpenseFormDialog } from "@/features/expenses/expense-form-dialog";
import { ExpenseRow } from "@/features/expenses/expense-row";
import { timeAgo } from "@/lib/time-ago";
import { formatCurrency } from "@/lib/format-currency";
import {
  getAcquisition,
  getHealthScore,
  getInsuranceDaysLeft,
  getLastServiceKmAgo,
  getOwnedLabel,
} from "@/lib/car-facts";
import type { Expense } from "@/lib/expenses-api";
import type { CarNote } from "@/lib/notes-api";
import { useCarAnalytics } from "@/hooks/use-analytics";
import { useCar, useDeleteCar, useUpdateCar } from "@/hooks/use-cars";
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from "@/hooks/use-expenses";
import { useCarNotes, useCreateNote, useDeleteNote } from "@/hooks/use-notes";

type TabKey = "overview" | "expenses";

export default function CarDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: car, isLoading, isError } = useCar(params.id);
  const updateCar = useUpdateCar(params.id);
  const deleteCar = useDeleteCar();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("overview");

  const { data: expensesPage, isLoading: expensesLoading } = useExpenses(params.id);
  const createExpense = useCreateExpense(params.id);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const updateExpense = useUpdateExpense(params.id, editingExpense?.id ?? "");
  const deleteExpense = useDeleteExpense(params.id);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "ALL">("ALL");
  const [dataIoOpen, setDataIoOpen] = useState(false);

  const { data: analytics, isLoading: analyticsLoading } = useCarAnalytics(params.id);
  const { data: notes, isLoading: notesLoading } = useCarNotes(params.id);
  const createNote = useCreateNote(params.id);
  const deleteNote = useDeleteNote(params.id);
  const [addNoteOpen, setAddNoteOpen] = useState(false);

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
  const acquisition = getAcquisition(car, expenses);
  const ownedLabel = getOwnedLabel(acquisition);
  const lastServiceKmAgo = getLastServiceKmAgo(car, expenses);
  const insuranceDaysLeft = getInsuranceDaysLeft(car);
  const health = getHealthScore(car, expenses);

  const filteredExpenses =
    categoryFilter === "ALL" ? expenses : expenses.filter((e) => e.category === categoryFilter);
  const monthGroups = groupByMonth(filteredExpenses);

  return (
    <Stack spacing={3} sx={{ maxWidth: 900 }}>
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
            {car.make} {car.model}
          </Typography>
          <Typography sx={{ color: "text.secondary", fontSize: 13.5, mt: 0.5 }}>
            {car.variant} · {car.year} · {car.engine} · {car.transmission}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mt: 1.5 }}>
            {car.usageTag && <Chip size="small" label={car.usageTag} />}
            <Chip size="small" label={ownedLabel} />
            {health.score != null && (
              <Chip
                size="small"
                label={`Health ${health.score}%`}
                color={health.score >= 80 ? "success" : health.score >= 50 ? "warning" : "error"}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}>
            <Button
              variant="contained"
              onClick={() => {
                setEditingExpense(null);
                setExpenseFormOpen(true);
              }}
            >
              + Expense
            </Button>
            <Button variant="outlined" onClick={() => setAddNoteOpen(true)}>
              Add Note
            </Button>
            <Button variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="outlined" color="error" onClick={() => setConfirmDeleteOpen(true)}>
              Delete
            </Button>
          </Stack>
        </Box>
      </Stack>

      <Tabs value={tab} onChange={(_, value: TabKey) => setTab(value)}>
        <Tab value="overview" label="Overview" />
        <Tab value="expenses" label="Expenses" />
      </Tabs>

      {tab === "overview" && (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                value={formatCurrency(analytics?.totalSpend ?? 0)}
                label="Total spent"
                accent
                loading={analyticsLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                value={analytics?.costPerKm != null ? `₹${analytics.costPerKm.toFixed(2)}/km` : "—"}
                label="Cost per km"
                loading={analyticsLoading}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard
                value={analytics?.trackedKm != null ? `${analytics.trackedKm.toLocaleString()} km` : "—"}
                label="Tracked"
                loading={analyticsLoading}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Panel title="Recent Expenses">
                {expensesLoading ? (
                  <PanelLoading />
                ) : expenses.length === 0 ? (
                  <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                    No expenses logged yet.
                  </Typography>
                ) : (
                  expenses
                    .slice(0, 5)
                    .map((expense) => (
                      <ExpenseRow
                        key={expense.id}
                        expense={expense}
                        onView={() => setViewingExpense(expense)}
                        onEdit={() => {
                          setEditingExpense(expense);
                          setExpenseFormOpen(true);
                        }}
                        onDelete={() => setDeletingExpenseId(expense.id)}
                      />
                    ))
                )}
              </Panel>
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Panel title="Quick Facts">
                <Stack spacing={1.5}>
                  <FactRow
                    label={acquisition.label}
                    value={
                      new Date(acquisition.date).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      }) + (acquisition.purchasePrice ? ` · ${formatCurrency(acquisition.purchasePrice)}` : "")
                    }
                  />
                  <FactRow
                    label="Last service"
                    value={lastServiceKmAgo != null ? `${lastServiceKmAgo.toLocaleString()} km ago` : "Not logged yet"}
                  />
                  <FactRow
                    label="Insurance"
                    value={
                      insuranceDaysLeft == null
                        ? "Not set"
                        : insuranceDaysLeft < 0
                          ? "Expired"
                          : `${insuranceDaysLeft} days left`
                    }
                    chipColor={
                      insuranceDaysLeft == null
                        ? undefined
                        : insuranceDaysLeft < 30
                          ? "error"
                          : insuranceDaysLeft < 90
                            ? "warning"
                            : "success"
                    }
                  />
                </Stack>
              </Panel>
            </Grid>
          </Grid>

          {analyticsLoading && (
            <Panel title="Spending Breakdown">
              <PanelLoading />
            </Panel>
          )}
          {!analyticsLoading && analytics && analytics.spendByCategory.length > 0 && (
            <Panel title="Spending Breakdown">
              <CategoryBreakdownBars rows={analytics.spendByCategory} />
            </Panel>
          )}

          <Panel
            title="Notes"
            action={
              <Button size="small" onClick={() => setAddNoteOpen(true)}>
                + Add
              </Button>
            }
          >
            {notesLoading ? (
              <PanelLoading />
            ) : !notes || notes.length === 0 ? (
              <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>
                No notes yet.
              </Typography>
            ) : (
              notes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  isDeleting={deleteNote.isPending && deleteNote.variables === note.id}
                  onDelete={() => deleteNote.mutate(note.id)}
                />
              ))
            )}
          </Panel>
        </Stack>
      )}

      {tab === "expenses" && (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1.5 }}>
            <TextField
              select
              size="small"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | "ALL")}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="ALL">All categories</MenuItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" size="small" onClick={() => setDataIoOpen(true)}>
                ↑ Import
              </Button>
              <Button variant="outlined" size="small" onClick={() => setDataIoOpen(true)}>
                ↓ Export
              </Button>
            </Stack>
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
            {expensesLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            )}

            {!expensesLoading && filteredExpenses.length === 0 && (
              <Typography sx={{ fontSize: 13.5, color: "text.secondary", py: 1 }}>
                No expenses in this category yet.
              </Typography>
            )}

            {monthGroups.map(([month, monthExpenses]) => (
              <Box key={month} sx={{ mb: 2, "&:last-of-type": { mb: 0 } }}>
                <Typography
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                    textTransform: "uppercase",
                    mb: 0.5,
                  }}
                >
                  {month}
                </Typography>
                {monthExpenses.map((expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onView={() => setViewingExpense(expense)}
                    onEdit={() => {
                      setEditingExpense(expense);
                      setExpenseFormOpen(true);
                    }}
                    onDelete={() => setDeletingExpenseId(expense.id)}
                  />
                ))}
              </Box>
            ))}
          </Box>
        </Stack>
      )}

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
          usageTag: car.usageTag ?? "",
          insuranceExpiryDate: car.insuranceExpiryDate ?? "",
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
        onInsuranceExpiryDateSet={(date) => {
          updateCar.mutate({ insuranceExpiryDate: date });
        }}
      />

      <AddNoteDialog
        open={addNoteOpen}
        onClose={() => setAddNoteOpen(false)}
        isSubmitting={createNote.isPending}
        error={createNote.error?.message}
        onSubmit={(body) => {
          createNote.mutate(body, { onSuccess: () => setAddNoteOpen(false) });
        }}
      />

      <DataIoDialog open={dataIoOpen} onClose={() => setDataIoOpen(false)} />

      <ExpenseDetailDialog expense={viewingExpense} onClose={() => setViewingExpense(null)} />

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
            loading={deleteCar.isPending}
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
            loading={deleteExpense.isPending}
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

function groupByMonth(expenses: Expense[]): [string, Expense[]][] {
  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const key = new Date(expense.expenseDate).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(expense);
    } else {
      groups.set(key, [expense]);
    }
  }
  return Array.from(groups.entries());
}

function FactRow({
  label,
  value,
  chipColor,
}: {
  label: string;
  value: string;
  chipColor?: "success" | "warning" | "error";
}) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
      <Typography sx={{ fontSize: 13.5, color: "text.secondary" }}>{label}</Typography>
      {chipColor ? (
        <Chip size="small" label={value} color={chipColor} />
      ) : (
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{value}</Typography>
      )}
    </Stack>
  );
}

function NoteRow({
  note,
  isDeleting,
  onDelete,
}: {
  note: CarNote;
  isDeleting: boolean;
  onDelete: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        py: 1.5,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: "9px",
          bgcolor: "background.default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        📝
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: 13.5 }}>{note.body}</Typography>
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{timeAgo(note.createdAt)}</Typography>
      </Box>
      <Button
        size="small"
        loading={isDeleting}
        onClick={onDelete}
        sx={{ color: "text.secondary", minWidth: "auto" }}
      >
        ✕
      </Button>
    </Stack>
  );
}
