import type { Metadata } from "next";
import { DashboardShell } from "@/features/shell/dashboard-shell";

export const metadata: Metadata = {
  // A plain string title here would drop the root's "%s · Glovebox"
  // template for every page below this layout.
  title: { default: "Your garage", template: "%s · Glovebox" },
  description: "Your cars, their running costs and recent expenses.",
  // Signed-in pages: nothing for a search engine here.
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
