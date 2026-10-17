import { NextResponse, type NextRequest } from "next/server";

// Stamps proxied API requests with the real client IP plus a secret shared
// with the backend, so its rate limiter can key on the user instead of on
// Vercel's egress IP — and can tell this proxy apart from someone calling the
// backend directly with a made-up IP header. next.config.ts still does the
// actual forwarding to the backend.
//
// Not applied to the spreadsheet import: Vercel caps request bodies that
// pass through proxy at 4 MB and imports go up to 5 MB. That one route falls
// back to being rate-limited by the proxy's IP, which is fine for how rarely
// it's called.
export function proxy(request: NextRequest) {
  const secret = process.env.API_PROXY_SECRET;
  if (!secret) return NextResponse.next();

  // Vercel overwrites these with the connecting client's IP, so a browser
  // can't spoof them.
  const clientIp = (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip")
  )
    ?.split(",")[0]
    ?.trim();

  const headers = new Headers(request.headers);
  headers.set("x-glovebox-proxy-secret", secret);
  if (clientIp) {
    headers.set("x-glovebox-client-ip", clientIp);
  } else {
    headers.delete("x-glovebox-client-ip");
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/api/v1/((?!data-io/import$).*)"],
};
