import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username);
  return {
    title: `@${handle}'s garage`,
    description: `The cars in @${handle}'s garage on Glovebox.`,
  };
}

export default function FriendGarageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
