import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Friends",
  description: "Find friends on Glovebox, manage friend requests and see their garages.",
};

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
