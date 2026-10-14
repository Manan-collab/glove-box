import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ThemeRegistry from "./theme-registry";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Glovebox",
  description: "Your garage, tracked.",
};

// viewportFit "cover" lets the mobile bottom nav extend under the iPhone home
// indicator and pad itself with env(safe-area-inset-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EBEEF8" },
    { media: "(prefers-color-scheme: dark)", color: "#14161D" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <ThemeRegistry>
          <Providers>{children}</Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}
