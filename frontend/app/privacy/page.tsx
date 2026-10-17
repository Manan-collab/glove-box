import { Box, Container, Link, Typography } from "@mui/material";
import { PublicFooter, PublicHeader } from "@/features/marketing/public-shell";
import { CONTACT_EMAIL, publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Privacy Policy",
  description:
    "What Glovebox stores about you and your cars, who can see it, the cookies it uses, and how to export or delete your data.",
  path: "/privacy",
});

const LAST_UPDATED = "17 October 2026";

// Keep this in step with the code: if a new field, cookie, third party or
// sharing rule ships, the matching section here needs updating too.
export default function PrivacyPage() {
  return (
    <Box sx={{ minHeight: "100dvh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <PublicHeader />
      <Container component="main" maxWidth="md" sx={{ flex: 1, py: { xs: 4, md: 7 } }}>
        <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: 30, md: 40 }, letterSpacing: -0.5 }}>
          Privacy Policy
        </Typography>
        <Typography sx={{ color: "text.secondary", fontSize: 14, mt: 1, mb: 4 }}>
          Last updated {LAST_UPDATED}
        </Typography>

        <P>
          Glovebox helps you keep track of what your cars cost to run. This page explains, in plain language, what we
          store, why, who can see it, and what you can do about it.
        </P>

        <H2>What we collect</H2>
        <H3>From your Google account, when you sign in</H3>
        <List
          items={[
            "Your email address, name and profile photo link.",
            "Google's account ID for you, so we can recognise you next time.",
          ]}
        />
        <P>
          We never see or store your Google password. We also create a username for you from your email address.
        </P>
        <H3>What you add</H3>
        <List
          items={[
            "Cars: make, model, year, variant, engine, fuel type, transmission, body type, power, odometer reading, and optionally the VIN, a usage tag and your insurance expiry date.",
            "Expenses: amount, date, category, odometer reading, notes, and category details such as litres and price per litre, fuel station, workshop name, work done, what broke, or tyre brand and size.",
            "Notes you add to a car.",
            "Friend requests and friendships.",
          ]}
        />
        <H3>Automatically</H3>
        <List
          items={[
            "Server logs that record each request's method, path, status and timing. Our hosting providers may also log your IP address as part of running their services.",
            "Your IP address, held in memory for about a minute to rate-limit requests and protect the service from abuse.",
          ]}
        />
        <P>We don&apos;t use analytics, advertising or tracking tools, and we don&apos;t sell your data.</P>

        <H2>How we use it</H2>
        <P>
          Only to run Glovebox: to sign you in, show you your garage and expenses, calculate your analytics (such as
          monthly spend and cost per km), let you connect with friends, and keep the service secure.
        </P>

        <H2>Who can see your data</H2>
        <List
          items={[
            "Any signed-in user can find you by username or name in friend search, which shows your username, name and profile photo.",
            "Friends you've accepted can also see your cars' make, model, year, variant, engine, fuel type, transmission, body type and power.",
            "Nobody else sees your expenses, notes, odometer readings, VIN, insurance dates or email address.",
          ]}
        />

        <H2>Cookies and local storage</H2>
        <P>Glovebox sets two cookies, both needed to keep you signed in:</P>
        <List
          items={[
            "access_token: proves you're signed in. Expires after 15 minutes and is renewed automatically.",
            "refresh_token: renews your sign-in. Expires after 7 days without use.",
          ]}
        />
        <P>
          Both are HttpOnly (page scripts can&apos;t read them) and are only sent to Glovebox. Your browser also
          remembers your light/dark theme choice in local storage. The Google sign-in button is provided by Google,
          which may set its own cookies under{" "}
          <Link href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
            Google&apos;s Privacy Policy
          </Link>
          .
        </P>

        <H2>Services we rely on</H2>
        <List
          items={[
            "Google: sign-in.",
            "Vercel: hosts the website and forwards requests to our server.",
            "Render: runs our server.",
            "Neon: hosts our database, on servers in the United States.",
          ]}
        />
        <P>They process data on our behalf only to provide these services.</P>

        <H2>Your choices</H2>
        <List
          items={[
            "Edit or delete any car or expense, and delete any note, at any time from your dashboard.",
            "Export all of your cars and expenses to an Excel file from the dashboard's import/export option.",
            "Remove a friend at any time. They immediately lose access to your garage.",
            "Ask us to delete your account and everything in it using the contact details below.",
          ]}
        />

        <H2>How long we keep it</H2>
        <P>
          We keep your data while your account exists. When you delete something, it&apos;s removed from our database.
          When you ask us to delete your account, we delete it and all of its cars, expenses, notes and friendships.
        </P>

        <H2>Security</H2>
        <P>
          Data is sent over HTTPS, sign-in cookies can&apos;t be read by page scripts, and every request is checked so
          you can only reach your own data and what friends have shared with you. No system is perfectly secure, but we
          work to keep yours safe.
        </P>

        <H2>Children</H2>
        <P>Glovebox is meant for drivers and isn&apos;t aimed at children.</P>

        <H2>Changes to this policy</H2>
        <P>
          If we change how we handle your data, we&apos;ll update this page and the date at the top.
        </P>

        <H2>Contact</H2>
        {CONTACT_EMAIL ? (
          <P>
            For questions, data requests or account deletion, email{" "}
            <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
          </P>
        ) : (
          <P>A contact address for privacy questions and deletion requests will be added here shortly.</P>
        )}
      </Container>
      <PublicFooter />
    </Box>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="h2" sx={{ fontWeight: 700, fontSize: { xs: 20, md: 23 }, mt: 5, mb: 1.5 }}>
      {children}
    </Typography>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <Typography component="h3" sx={{ fontWeight: 600, fontSize: 16, mt: 2.5, mb: 1 }}>
      {children}
    </Typography>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: 15.5, lineHeight: 1.7, color: "text.secondary", mb: 1.5 }}>{children}</Typography>;
}

function List({ items }: { items: string[] }) {
  return (
    <Box component="ul" sx={{ pl: 3, my: 1, mb: 1.5 }}>
      {items.map((item) => (
        <Typography component="li" key={item} sx={{ fontSize: 15.5, lineHeight: 1.7, color: "text.secondary", mb: 0.75 }}>
          {item}
        </Typography>
      ))}
    </Box>
  );
}
