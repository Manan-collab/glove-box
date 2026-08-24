export type ExpenseCategory =
  | "PURCHASE"
  | "FUEL"
  | "SERVICE"
  | "REPAIR"
  | "TYRES"
  | "BATTERY"
  | "MOD"
  | "INSURANCE"
  | "OTHER";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; icon: string }[] = [
  { value: "PURCHASE", label: "Purchase", icon: "🔑" },
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

export type CategoryAccent = "primary" | "success" | "warning" | "error" | "default";

export function categoryAccent(category: string): CategoryAccent {
  switch (category) {
    case "FUEL":
      return "warning";
    case "SERVICE":
    case "MOD":
    case "INSURANCE":
      return "primary";
    case "REPAIR":
      return "error";
    case "BATTERY":
    case "PURCHASE":
      return "success";
    default:
      return "default";
  }
}
