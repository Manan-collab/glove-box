import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { OG_IMAGE_ALT } from "@/lib/site";

// Rendered once at build time. Inter is vendored in assets/fonts because the
// renderer only bundles a regular-weight Geist, and the headline needs 800.
export const alt = OG_IMAGE_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CATEGORIES = ["Fuel", "Service", "Repairs", "Tyres", "Insurance"];

export default async function OpengraphImage() {
  const [medium, extraBold] = await Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Inter-500.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Inter-800.ttf")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#14161D",
          backgroundImage:
            "radial-gradient(circle at 88% 8%, rgba(91, 140, 255, 0.35) 0%, rgba(91, 140, 255, 0) 55%)",
          fontFamily: "Inter",
          color: "#F2F3F7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#2F6BFF" />
            <path
              d="M43.3 20.7A16 16 0 1 0 48 32H34"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 800, letterSpacing: 1 }}>
            GLOVE<span style={{ color: "#5B8CFF" }}>BOX</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 80,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
            }}
          >
            <span>Know what your car</span>
            <span style={{ color: "#5B8CFF" }}>really costs.</span>
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "#A6A9B6" }}>
            Every expense logged. Per month, per km, per car.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 12 }}>
            {CATEGORIES.map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "10px 20px",
                  borderRadius: 999,
                  border: "1px solid #2B2E39",
                  backgroundColor: "#1C1F28",
                  fontSize: 24,
                  fontWeight: 500,
                  color: "#F2F3F7",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 24, fontWeight: 500, color: "#A6A9B6" }}>
            Free · Sign in with Google
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: medium, style: "normal", weight: 500 },
        { name: "Inter", data: extraBold, style: "normal", weight: 800 },
      ],
    },
  );
}
