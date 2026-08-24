import { z } from "zod";

const optionalNumber = z.preprocess(
  (val) => (val === "" || val === undefined ? undefined : Number(val)),
  z.number().positive().optional(),
);

export const expenseFormSchema = z.object({
  category: z.enum([
    "PURCHASE",
    "FUEL",
    "SERVICE",
    "REPAIR",
    "TYRES",
    "BATTERY",
    "MOD",
    "INSURANCE",
    "OTHER",
  ]),
  amount: z.coerce.number().positive("Enter an amount"),
  expenseDate: z.string().min(1, "Required"),
  odometerKm: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(0).optional(),
  ),
  notes: z.string().optional(),
  workshopName: z.string().optional(),
  workPerformed: z.string().optional(),
  whatBroke: z.string().optional(),
  litres: optionalNumber,
  fuelPricePerLitre: optionalNumber,
  fuelStation: z.string().optional(),
  tyreBrand: z.string().optional(),
  tyreSize: z.string().optional(),
  // UI-only convenience field: not a real Expense column. When set on an
  // INSURANCE expense, the dialog reports it separately so the caller can
  // update the car's own insuranceExpiryDate instead of sending it as part
  // of the expense payload (which the backend would reject as unknown).
  insuranceExpiryDate: z.string().optional(),
});

export type ExpenseFormSchema = z.infer<typeof expenseFormSchema>;
