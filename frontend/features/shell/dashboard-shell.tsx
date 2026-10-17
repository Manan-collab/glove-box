"use client";

import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Fab,
  ListItemIcon,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QuickAddExpenseDialog } from "@/features/expenses/quick-add-expense-dialog";
import { ThemeToggle } from "@/features/shell/theme-toggle";
import { useLogout, useMe } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api-client";

const SIDEBAR_WIDTH = 224;
// Below `md` the sidebar is replaced by a fixed bottom nav plus a floating
// "+" button for adding an expense.
const BOTTOM_NAV_HEIGHT = 64;
const SAFE_AREA_BOTTOM = "env(safe-area-inset-bottom, 0px)";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "🏠", label: "Garage", isActive: (path: string) => path === "/dashboard" },
  {
    href: "/dashboard/analytics",
    icon: "📊",
    label: "Analytics",
    isActive: (path: string) => path === "/dashboard/analytics",
  },
  {
    href: "/dashboard/friends",
    icon: "👥",
    label: "Friends",
    isActive: (path: string) => path.startsWith("/dashboard/friends"),
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError, error, refetch, isFetching } = useMe();
  const logout = useLogout();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Only a 401 means "signed out". A 429 or network blip shouldn't kick the
  // user to /login — that used to ping-pong with the login page and hammer
  // /auth/me until the rate limiter locked everything out.
  const isUnauthenticated = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (isUnauthenticated) {
      router.replace("/login");
    }
  }, [isUnauthenticated, router]);

  if (isError && !isUnauthenticated && !data) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
          <Typography sx={{ color: "text.secondary" }}>
            Couldn&apos;t reach the server. Please try again in a moment.
          </Typography>
          <Button variant="outlined" onClick={() => refetch()} disabled={isFetching}>
            Retry
          </Button>
        </Stack>
      </Box>
    );
  }

  if (isLoading || !data) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress aria-label="Loading your garage" />
      </Box>
    );
  }

  const user = data.user;
  const initial = (user.displayName ?? user.username).charAt(0).toUpperCase();

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <Box
        component="aside"
        sx={(theme) => ({
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          bgcolor: "background.paper",
          ...theme.applyStyles("light", { backgroundColor: theme.palette.background.default }),
          borderRight: "1px solid",
          borderColor: "divider",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          p: 2,
          position: "fixed",
          top: 0,
          left: 0,
          height: "100dvh",
        })}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 19, px: 1.25, pb: 3 }}>
          GLOVE<Box component="span" sx={{ color: "primary.main" }}>BOX</Box>
        </Typography>
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              icon={item.icon}
              label={item.label}
              active={item.isActive(pathname)}
            />
          ))}
        </Stack>

        <Button variant="contained" fullWidth onClick={() => setQuickAddOpen(true)}>
          + Add Expense
        </Button>
      </Box>
      <QuickAddExpenseDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          ml: { xs: 0, md: `${SIDEBAR_WIDTH}px` },
        }}
      >
        <Box
          component="header"
          sx={(theme) => ({
            position: "sticky",
            top: 0,
            zIndex: 30,
            bgcolor: "background.paper",
            ...theme.applyStyles("light", { backgroundColor: theme.palette.background.default }),
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: 2, md: 4 },
            height: 60,
          })}
        >
          <Typography
            component={Link}
            href="/dashboard"
            sx={{
              display: { xs: "block", md: "none" },
              fontWeight: 800,
              fontSize: 17,
              color: "text.primary",
              textDecoration: "none",
            }}
          >
            GLOVE<Box component="span" sx={{ color: "primary.main" }}>BOX</Box>
          </Typography>
          <Typography
            noWrap
            sx={{ display: { xs: "none", md: "block" }, fontSize: 13.5, fontWeight: 600, color: "text.secondary" }}
          >
            {user.displayName ?? user.username}&apos;s Garage
          </Typography>
          <Box>
            <Stack
              component="button"
              type="button"
              direction="row"
              spacing={1.25}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={!!anchorEl}
              sx={{
                alignItems: "center",
                cursor: "pointer",
                px: 1.25,
                py: 0.75,
                border: 0,
                bgcolor: "transparent",
                color: "inherit",
                font: "inherit",
                borderRadius: "10px",
                "&:hover": { bgcolor: "action.hover" },
                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main" },
              }}
            >
              {/* alt="": the button's own label already names it, and the
                  user's name sits right beside the photo. */}
              <Avatar
                src={user.avatarUrl ?? undefined}
                alt=""
                sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700 }}
              >
                {initial}
              </Avatar>
              <Typography
                noWrap
                sx={{ display: { xs: "none", sm: "block" }, maxWidth: 200, fontSize: 13.5, fontWeight: 600 }}
              >
                {user.displayName ?? user.username}
              </Typography>
            </Stack>
            <Menu
              anchorEl={anchorEl}
              open={!!anchorEl}
              onClose={() => setAnchorEl(null)}
              slotProps={{ paper: { sx: { width: 230, mt: 1 } } }}
            >
              <Box sx={{ px: 1.5, py: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                  {user.displayName ?? user.username}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  @{user.username}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1.5, py: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>Theme</Typography>
                <ThemeToggle />
              </Box>
              <Divider sx={{ my: 0.5 }} />
              <MenuItem
                disabled={logout.isPending}
                onClick={() => {
                  logout.mutate(undefined, { onSuccess: () => router.push("/login") });
                }}
                sx={{ color: "error.main" }}
              >
                <ListItemIcon sx={{ color: "error.main" }}>
                  {logout.isPending ? (
                    <CircularProgress size={16} color="error" aria-label="Logging out" />
                  ) : (
                    <span aria-hidden="true">🚪</span>
                  )}
                </ListItemIcon>
                Log out
              </MenuItem>
            </Menu>
          </Box>
        </Box>

        <Box
          component="main"
          sx={{
            flex: 1,
            pb: { xs: `calc(${BOTTOM_NAV_HEIGHT + 72}px + ${SAFE_AREA_BOTTOM})`, md: 0 },
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--mui-palette-primary-main) 6%, var(--mui-palette-background-default)) 0%, var(--mui-palette-background-default) 480px)",
          }}
        >
          <Box sx={{ p: { xs: 2, sm: 3, md: 5 }, maxWidth: 1220, mx: "auto" }}>{children}</Box>
        </Box>
      </Box>

      <Fab
        color="primary"
        aria-label="Add expense"
        onClick={() => setQuickAddOpen(true)}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          right: 16,
          bottom: `calc(${BOTTOM_NAV_HEIGHT + 16}px + ${SAFE_AREA_BOTTOM})`,
          fontSize: 28,
          fontWeight: 400,
        }}
      >
        +
      </Fab>

      <Box
        component="nav"
        aria-label="Main"
        sx={(theme) => ({
          display: { xs: "flex", md: "none" },
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          height: `calc(${BOTTOM_NAV_HEIGHT}px + ${SAFE_AREA_BOTTOM})`,
          pb: SAFE_AREA_BOTTOM,
          bgcolor: "background.paper",
          ...theme.applyStyles("light", { backgroundColor: theme.palette.background.default }),
          borderTop: "1px solid",
          borderColor: "divider",
        })}
      >
        {NAV_ITEMS.map((item) => (
          <MobileNavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={item.isActive(pathname)}
          />
        ))}
      </Box>
    </Box>
  );
}

function MobileNavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Stack
      component={Link}
      href={href}
      aria-current={active ? "page" : undefined}
      spacing={0.25}
      sx={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
        color: active ? "primary.main" : "text.secondary",
        fontWeight: active ? 700 : 500,
        fontSize: 12,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <Box
        component="span"
        aria-hidden="true"
        sx={{
          fontSize: 18,
          lineHeight: 1,
          px: 2,
          py: 0.5,
          borderRadius: "999px",
          bgcolor: active ? "action.selected" : "transparent",
        }}
      >
        {icon}
      </Box>
      <span>{label}</span>
    </Stack>
  );
}

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active: boolean;
}) {
  return (
    <Stack
      component={Link}
      href={href}
      direction="row"
      spacing={1.5}
      sx={{
        alignItems: "center",
        px: 1.5,
        py: 1.25,
        borderRadius: "9px",
        textDecoration: "none",
        bgcolor: active ? "action.selected" : "transparent",
        color: active ? "primary.main" : "text.secondary",
        fontWeight: active ? 600 : 500,
        fontSize: 14.5,
        "&:hover": { bgcolor: active ? "action.selected" : "action.hover", color: active ? "primary.main" : "text.primary" },
      }}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </Stack>
  );
}
