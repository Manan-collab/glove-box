import { Box, Button, Card, Container, Stack, Typography } from "@mui/material";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PublicFooter, PublicHeader } from "@/features/marketing/public-shell";
import { publicPageMetadata, SITE_DESCRIPTION } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Glovebox · Track what your car really costs",
  description: SITE_DESCRIPTION,
  path: "/",
});

const FEATURES = [
  {
    icon: "⛽",
    title: "Log an expense in seconds",
    body: "Fuel, service, repairs, tyres, battery, insurance and mods, each with the details that matter, like litres and price per litre for fuel.",
  },
  {
    icon: "📊",
    title: "See the real running cost",
    body: "Monthly spend, cost per km, spending by category and a health score per car. Find out which car is costing you more.",
  },
  {
    icon: "👥",
    title: "Peek at friends' garages",
    body: "Add friends and see what they drive. Your expenses, VIN and odometer stay private.",
  },
  {
    icon: "📥",
    title: "Your data, in Excel",
    body: "Import your existing records from a spreadsheet and export everything whenever you like.",
  },
];

// Illustrative rows for the hero preview; labelled "Example" on the card.
const EXAMPLE_ROWS = [
  { icon: "⛽", label: "Fuel · 32.4 L", amount: "₹3,450" },
  { icon: "🔧", label: "Service · 40,000 km", amount: "₹8,900" },
  { icon: "🛞", label: "Tyres · front pair", amount: "₹11,200" },
  { icon: "📄", label: "Insurance renewal", amount: "₹14,750" },
];

export default async function Home() {
  // Auth cookies are first-party (the API is proxied through this origin),
  // so signed-in visitors can skip the landing page without a round trip.
  // Presence isn't validity: a stale cookie lands on /dashboard, which sends
  // the user on to /login after its /auth/me check fails.
  if ((await cookies()).has("refresh_token")) {
    redirect("/dashboard");
  }

  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <PublicHeader />

      <Box component="main" sx={{ flex: 1 }}>
        <Box
          component="section"
          aria-labelledby="hero-title"
          sx={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--mui-palette-primary-main) 10%, var(--mui-palette-background-default)) 0%, var(--mui-palette-background-default) 100%)",
          }}
        >
          <Container
            maxWidth="lg"
            sx={{
              py: { xs: 5, md: 10 },
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
              gap: { xs: 5, md: 8 },
              alignItems: "center",
            }}
          >
            <Stack spacing={{ xs: 2.5, md: 3 }} sx={{ alignItems: "flex-start" }}>
              <Typography
                id="hero-title"
                component="h1"
                sx={{
                  fontWeight: 800,
                  fontSize: { xs: 36, sm: 46, md: 56 },
                  lineHeight: 1.05,
                  letterSpacing: { xs: -1, md: -1.5 },
                }}
              >
                Know what your car{" "}
                <Box component="span" sx={{ color: "primary.main" }}>
                  really costs.
                </Box>
              </Typography>
              <Typography sx={{ fontSize: { xs: 16, md: 19 }, color: "text.secondary", maxWidth: 520 }}>
                Log fuel, service, repairs and insurance in a few taps. Glovebox adds it all up per month, per km and
                per car.
              </Typography>
              <Stack spacing={1.25} sx={{ alignItems: "flex-start", pt: 0.5 }}>
                <Button href="/login" variant="contained" size="large" sx={{ px: 3.5, py: 1.4, fontSize: 16 }}>
                  Get started, it&apos;s free
                </Button>
                <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
                  Sign in with Google. No passwords, no credit card.
                </Typography>
              </Stack>
            </Stack>

            <ExampleCard />
          </Container>
        </Box>

        <Container component="section" aria-labelledby="features-title" maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          <Typography
            id="features-title"
            component="h2"
            sx={{ fontWeight: 800, fontSize: { xs: 24, md: 32 }, mb: { xs: 3, md: 5 } }}
          >
            Everything your car costs, in one place
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
              gap: 2,
            }}
          >
            {FEATURES.map((feature) => (
              <Card key={feature.title} sx={{ p: 3 }}>
                <Box component="span" aria-hidden="true" sx={{ fontSize: 26, lineHeight: 1 }}>
                  {feature.icon}
                </Box>
                <Typography component="h3" sx={{ fontWeight: 700, fontSize: 17, mt: 1.5, mb: 1 }}>
                  {feature.title}
                </Typography>
                <Typography sx={{ fontSize: 14.5, color: "text.secondary" }}>{feature.body}</Typography>
              </Card>
            ))}
          </Box>

          <Stack
            spacing={2}
            sx={{
              mt: { xs: 6, md: 8 },
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <Typography component="h2" sx={{ fontWeight: 800, fontSize: { xs: 22, md: 28 } }}>
              Start tracking your garage today
            </Typography>
            <Button href="/login" variant="contained" size="large" sx={{ px: 3.5 }}>
              Get started, it&apos;s free
            </Button>
          </Stack>
        </Container>
      </Box>

      <PublicFooter />
    </Box>
  );
}

function ExampleCard() {
  return (
    <Card
      aria-label="Example of a car's expense list in Glovebox"
      sx={{ p: { xs: 2.5, md: 3 }, borderRadius: "18px", width: "100%", maxWidth: 480, justifySelf: { md: "end" } }}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 16 }}>Hyundai Creta 2022</Typography>
          <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>Last 30 days</Typography>
        </Box>
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: "text.secondary",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "999px",
            px: 1.25,
            py: 0.25,
          }}
        >
          Example
        </Typography>
      </Stack>
      <Stack component="ul" spacing={1} sx={{ listStyle: "none", m: 0, p: 0 }}>
        {EXAMPLE_ROWS.map((row) => (
          <Stack
            component="li"
            key={row.label}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "center", p: 1.25, borderRadius: "10px", bgcolor: "action.hover" }}
          >
            <Box component="span" aria-hidden="true" sx={{ fontSize: 18, width: 24, textAlign: "center" }}>
              {row.icon}
            </Box>
            <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{row.label}</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace" }}>
              {row.amount}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}
      >
        <Typography sx={{ fontSize: 13, color: "text.secondary" }}>Cost per km</Typography>
        <Typography sx={{ fontSize: 14, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace" }}>
          ₹7.80
        </Typography>
      </Stack>
    </Card>
  );
}
