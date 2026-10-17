import type { Metadata } from "next";

// The car's name needs the signed-in user's data, which only the client
// fetches — so this stays generic.
export const metadata: Metadata = {
  title: "Car details",
  description: "Expenses, notes and running costs for this car.",
};

export default function CarLayout({ children }: { children: React.ReactNode }) {
  return children;
}
