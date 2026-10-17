import { Box, Button, Container, Stack, Typography } from "@mui/material";

// Header and footer for the signed-out pages (landing, privacy, 404). Server
// components — plain hrefs instead of next/link, since a component can't be
// passed as a prop across the server/client boundary into MUI.

export function Wordmark({ size = 19 }: { size?: number }) {
  return (
    <Typography
      component="a"
      href="/"
      aria-label="Glovebox home"
      sx={{ fontWeight: 800, fontSize: size, letterSpacing: 0.5, color: "text.primary", textDecoration: "none" }}
    >
      GLOVE
      <Box component="span" sx={{ color: "primary.main" }}>
        BOX
      </Box>
    </Typography>
  );
}

export function PublicHeader({ showSignIn = true }: { showSignIn?: boolean }) {
  return (
    <Box component="header" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Container
        maxWidth="lg"
        sx={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <Wordmark />
        {showSignIn && (
          <Button href="/login" variant="text" sx={{ fontWeight: 600 }}>
            Sign in
          </Button>
        )}
      </Container>
    </Box>
  );
}

export function PublicFooter() {
  return (
    <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "divider", py: 3 }}>
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
        >
          <Typography sx={{ fontSize: 13, color: "text.secondary" }}>
            © {new Date().getFullYear()} Glovebox
          </Typography>
          <Stack component="nav" aria-label="Footer" direction="row" spacing={2.5}>
            <FooterLink href="/privacy">Privacy Policy</FooterLink>
            <FooterLink href="/login">Sign in</FooterLink>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Typography
      component="a"
      href={href}
      sx={{ fontSize: 13, color: "text.secondary", textDecoration: "none", "&:hover": { color: "text.primary" } }}
    >
      {children}
    </Typography>
  );
}
