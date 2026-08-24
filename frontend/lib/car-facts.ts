import type { Car } from "./cars-api";
import type { Expense } from "./expenses-api";

// Simplifying assumption, not per-car configurable in this pass: a service
// every 10,000 km is treated as "fully healthy" for the service component
// of the health score below.
const SERVICE_INTERVAL_KM = 10_000;
const DAY_MS = 1000 * 60 * 60 * 24;

export interface Acquisition {
  label: "Bought" | "Added";
  date: string;
  purchasePrice?: number;
}

// "Bought" comes from the earliest PURCHASE-category expense, if one was
// logged — that's real user input. Otherwise we fall back to when the car
// was added to Glovebox, labeled "Added" rather than guessing a purchase date.
export function getAcquisition(car: Car, expenses: Expense[]): Acquisition {
  const purchases = expenses
    .filter((expense) => expense.category === "PURCHASE")
    .sort(
      (a, b) => new Date(a.expenseDate).getTime() - new Date(b.expenseDate).getTime(),
    );
  const purchase = purchases[0];

  if (purchase) {
    return { label: "Bought", date: purchase.expenseDate, purchasePrice: Number(purchase.amount) };
  }
  return { label: "Added", date: car.createdAt };
}

export function getOwnedLabel(acquisition: Acquisition): string {
  const years = (Date.now() - new Date(acquisition.date).getTime()) / (DAY_MS * 365.25);
  if (years < 1) {
    return acquisition.label === "Bought" ? "Owned <1 yr" : "Added recently";
  }
  const rounded = Math.floor(years);
  const verb = acquisition.label === "Bought" ? "Owned" : "Added";
  return `${verb} ${rounded} yr${rounded > 1 ? "s" : ""}`;
}

// km since the most recent SERVICE expense that recorded an odometer
// reading. null when no such expense exists — never guessed.
export function getLastServiceKmAgo(car: Car, expenses: Expense[]): number | null {
  const servicesWithOdometer = expenses.filter(
    (expense) => expense.category === "SERVICE" && expense.odometerKm != null,
  );
  if (servicesWithOdometer.length === 0) return null;

  const lastService = servicesWithOdometer.reduce((latest, expense) =>
    (expense.odometerKm ?? 0) > (latest.odometerKm ?? 0) ? expense : latest,
  );
  return Math.max(0, car.odometerKm - (lastService.odometerKm ?? 0));
}

export function getInsuranceDaysLeft(car: Car): number | null {
  if (!car.insuranceExpiryDate) return null;
  return Math.ceil((new Date(car.insuranceExpiryDate).getTime() - Date.now()) / DAY_MS);
}

export interface HealthScore {
  score: number | null;
}

// Two independent 0-100 components, averaged over whichever ones have real
// data behind them. Never fabricated: with no service history and no
// insurance date set, this returns null and no badge is shown at all.
export function getHealthScore(car: Car, expenses: Expense[]): HealthScore {
  const components: number[] = [];

  const kmSinceService = getLastServiceKmAgo(car, expenses);
  if (kmSinceService != null) {
    components.push(Math.min(100, Math.max(0, 100 - (kmSinceService / SERVICE_INTERVAL_KM) * 100)));
  }

  const daysLeft = getInsuranceDaysLeft(car);
  if (daysLeft != null) {
    if (daysLeft < 0) components.push(0);
    else if (daysLeft < 30) components.push(40);
    else if (daysLeft < 90) components.push(75);
    else components.push(100);
  }

  if (components.length === 0) return { score: null };
  const average = components.reduce((sum, value) => sum + value, 0) / components.length;
  return { score: Math.round(average) };
}
