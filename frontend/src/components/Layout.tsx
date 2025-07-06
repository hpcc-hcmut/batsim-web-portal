import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  AppBar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Divider,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard,
  Storage,
  Computer,
  Settings,
  Code,
  Science,
  Assessment,
  Analytics,
  AccountCircle,
  Logout,
} from "@mui/icons-material";
import useAuthStore from "../store/authStore";

const drawerWidth = 240;

interface MenuItem {
  text: string;
  icon: React.ReactNode;
  path: string;
}

const menuItems: MenuItem[] = [
  { text: "Dashboard", icon: <Dashboard />, path: "/" },
  { text: "Workloads", icon: <Storage />, path: "/workloads" },
  { text: "Platforms", icon: <Computer />, path: "/platforms" },
  { text: "Scenarios", icon: <Settings />, path: "/scenarios" },
  { text: "Strategies", icon: <Code />, path: "/strategies" },
  { text: "Experiments", icon: <Science />, path: "/experiments" },
  { text: "Results", icon: <Assessment />, path: "/results" },
  { text: "Analytics", icon: <Analytics />, path: "/analytics" },
];

const Layout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
    handleMenuClose();
  };

  const drawer = (
    <div>
      <Toolbar sx={{ minHeight: 72, px: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4a9eff 0%, #2d3748 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mr: 1.5,
            }}
          >
            <img
              src="/logo192.png"
              alt="Logo"
              style={{ width: 24, height: 24 }}
            />
          </Box>
          <Typography
            variant="h6"
            noWrap
            component="div"
            fontWeight={700}
            letterSpacing={1}
          >
            BatSim Portal
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <List sx={{ mt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mx: 1,
                color: location.pathname === item.path ? "#fff" : "inherit",
                fontWeight: location.pathname === item.path ? 700 : 500,
                background:
                  location.pathname === item.path
                    ? "linear-gradient(90deg, #4a9eff 0%, #2d3748 100%)"
                    : "none",
                boxShadow:
                  location.pathname === item.path
                    ? "0 2px 12px 0 rgba(74,158,255,0.15)"
                    : "none",
                "&:hover": {
                  background:
                    location.pathname === item.path
                      ? "linear-gradient(90deg, #4a9eff 0%, #2d3748 100%)"
                      : "rgba(74,158,255,0.08)",
                  color: "#e2e8f0",
                },
                transition: "background 0.2s, color 0.2s",
              }}
            >
              <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          background: "rgba(26,32,44,0.95)",
          boxShadow: "0 2px 8px 0 rgba(0,0,0,0.15)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Toolbar sx={{ minHeight: 72 }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: "none" } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            noWrap
            component="div"
            sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 1 }}
          >
            {menuItems.find((item) => item.path === location.pathname)?.text ||
              "Dashboard"}
          </Typography>
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              alignItems: "center",
              mr: 2,
            }}
          >
            <Box
              sx={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 2,
                px: 2,
                py: 0.5,
                minWidth: 180,
                color: "inherit",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                opacity: 0.7,
              }}
            >
              <span role="img" aria-label="search" style={{ marginRight: 8 }}>
                🔍
              </span>
              <span>Search...</span>
            </Box>
          </Box>
          <IconButton color="inherit" sx={{ mr: 1 }}>
            <span role="img" aria-label="theme">
              🌓
            </span>
          </IconButton>
          <IconButton
            size="large"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            keepMounted
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.username} ({user?.role})
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
        aria-label="mailbox folders"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
};

export default Layout;
