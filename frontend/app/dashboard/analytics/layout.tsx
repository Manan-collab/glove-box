import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Monthly spend, cost per km, spending by category and a health score for each of your cars.",
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
