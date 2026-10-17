import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Sign in",
  description: "Sign in to Glovebox with your Google account. No passwords to remember.",
  path: "/login",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
