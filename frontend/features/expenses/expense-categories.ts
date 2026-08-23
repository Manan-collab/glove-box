export type ExpenseCategory =
  | "FUEL"
  | "SERVICE"
  | "REPAIR"
  | "TYRES"
  | "BATTERY"
  | "MOD"
  | "INSURANCE"
  | "OTHER";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: "FUEL", label: "Fuel", icon: "⛽" },
  { value: "SERVICE", label: "Service", icon: "🔧" },
  { value: "REPAIR", label: "Repair", icon: "🔩" },
  { value: "TYRES", label: "Tyres", icon: "🛞" },
  { value: "BATTERY", label: "Battery", icon: "🔋" },
  { value: "MOD", label: "Mod", icon: "✨" },
  { value: "INSURANCE", label: "Insurance", icon: "📄" },
  { value: "OTHER", label: "Other", icon: "•••" },
];

export function categoryMeta(category: string) {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === category) ?? {
      value: category as ExpenseCategory,
      label: category,
      icon: "•••",
    }
  );
}
