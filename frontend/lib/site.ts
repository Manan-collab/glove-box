import type { Metadata } from "next";

// Server-only: read by metadata, robots.txt, sitemap.xml and the OG image.
// NEXT_PUBLIC_SITE_URL wins (set it if you add a custom domain); on Vercel
// the production domain is picked up automatically.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3001")
).replace(/\/+$/, "");

export const SITE_NAME = "Glovebox";

export const SITE_DESCRIPTION =
  "Log fuel, service, repairs and insurance for every car you own, and see what each one really costs you per month and per km. Free with Google sign-in.";

// Shown on the privacy policy for data/deletion requests. Set it on Vercel;
// the page says plainly that no address is configured if it's missing.
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;

// Full metadata for a public, shareable page. A child segment's openGraph
// replaces the parent's wholesale (no deep merge), so siteName/locale/type
// have to be restated here rather than inherited from the root layout.
export const OG_IMAGE_ALT =
  "Glovebox: know what your car really costs. Fuel, service, repairs and insurance, per month, per km, per car.";

// app/opengraph-image.tsx renders this; listed explicitly because a page that
// sets its own openGraph loses the file-based image otherwise.
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: OG_IMAGE_ALT };

export function publicPageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`;
  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_IN",
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [OG_IMAGE] },
  };
}
