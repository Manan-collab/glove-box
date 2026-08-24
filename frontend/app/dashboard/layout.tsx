"use client";

import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Divider,
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

const SIDEBAR_WIDTH = 224;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, isLoading, isError } = useMe();
  const logout = useLogout();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  useEffect(() => {
    if (isError) {
      router.replace("/login");
    }
  }, [isError, router]);

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
        <CircularProgress />
      </Box>
    );
  }

  const user = data.user;
  const initial = (user.displayName ?? user.username).charAt(0).toUpperCase();

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh" }}>
      <Box
        component="aside"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          p: 2,
          position: "fixed",
          top: 0,
          left: 0,
          height: "100dvh",
        }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: 19, px: 1.25, pb: 3 }}>
          GLOVE<Box component="span" sx={{ color: "primary.main" }}>BOX</Box>
        </Typography>
        <Stack spacing={0.5} sx={{ flex: 1 }}>
          <NavItem href="/dashboard" icon="🏠" label="Garage" active={pathname === "/dashboard"} />
          <NavItem
            href="/dashboard/analytics"
            icon="📊"
            label="Analytics"
            active={pathname === "/dashboard/analytics"}
          />
          <NavItem
            href="/dashboard/friends"
            icon="👥"
            label="Friends"
            active={pathname.startsWith("/dashboard/friends")}
          />
        </Stack>

        <Button variant="contained" fullWidth onClick={() => setQuickAddOpen(true)}>
          + Add Expense
        </Button>
        <QuickAddExpenseDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
      </Box>

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
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: { xs: 2, md: 4 },
            height: 60,
          }}
        >
          <Typography sx={{ fontSize: 13.5, fontWeight: 600, color: "text.secondary" }}>
            {user.displayName ?? user.username}&apos;s Garage
          </Typography>
          <Box>
            <Stack
              direction="row"
              spacing={1.25}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              sx={{
                alignItems: "center",
                cursor: "pointer",
                px: 1.25,
                py: 0.75,
                borderRadius: "10px",
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <Avatar
                src={user.avatarUrl ?? undefined}
                sx={{ width: 32, height: 32, fontSize: 13, fontWeight: 700 }}
              >
                {initial}
              </Avatar>
              <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>
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
                  {logout.isPending ? <CircularProgress size={16} color="error" /> : "🚪"}
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
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--mui-palette-primary-main) 6%, var(--mui-palette-background-default)) 0%, var(--mui-palette-background-default) 480px)",
          }}
        >
          <Box sx={{ p: { xs: 2, sm: 3, md: 5 }, maxWidth: 1220, mx: "auto" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
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
      <span>{icon}</span>
      <span>{label}</span>
    </Stack>
  );
}
