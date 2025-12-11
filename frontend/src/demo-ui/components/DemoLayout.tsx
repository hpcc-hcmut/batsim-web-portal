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
  Chip,
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

const drawerWidth = 240;

interface MenuItemType {
  text: string;
  icon: React.ReactNode;
  path: string;
}

const menuItems: MenuItemType[] = [
  { text: "Dashboard", icon: <Dashboard />, path: "/demo" },
  { text: "Workloads", icon: <Storage />, path: "/demo/workloads" },
  { text: "Platforms", icon: <Computer />, path: "/demo/platforms" },
  { text: "Scenarios", icon: <Settings />, path: "/demo/scenarios" },
  { text: "Strategies", icon: <Code />, path: "/demo/strategies" },
  { text: "Experiments", icon: <Science />, path: "/demo/experiments" },
  { text: "Results", icon: <Assessment />, path: "/demo/results" },
  { text: "Analytics", icon: <Analytics />, path: "/demo/analytics" },
];

const DemoLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

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
    navigate("/login");
    handleMenuClose();
  };

  const isActive = (path: string) => {
    if (path === "/demo") {
      return location.pathname === "/demo" || location.pathname === "/demo/";
    }
    return location.pathname.startsWith(path);
  };

  const getCurrentPageTitle = () => {
    const current = menuItems.find((item) => isActive(item.path));
    return current?.text || "Dashboard";
  };

  const drawer = (
    <div>
      <Toolbar sx={{ minHeight: 72, px: 2, justifyContent: "center" }}>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <a href="/demo">
            <img
              src="/src/assets/batweb-title-logo-white.png"
              alt="BatSim Portal"
              style={{
                maxWidth: 180,
                width: "100%",
                height: "auto",
                display: "block",
                margin: "0 auto",
              }}
            />
          </a>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <List sx={{ mt: 2 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              selected={isActive(item.path)}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2,
                mx: 1,
                color: isActive(item.path) ? "#fff" : "inherit",
                fontWeight: isActive(item.path) ? 700 : 500,
                background: isActive(item.path)
                  ? "linear-gradient(90deg, #4a9eff 0%, #2d3748 100%)"
                  : "none",
                boxShadow: isActive(item.path)
                  ? "0 2px 12px 0 rgba(74,158,255,0.15)"
                  : "none",
                "&:hover": {
                  background: isActive(item.path)
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
            {getCurrentPageTitle()}
          </Typography>
          {/* <Chip
            label="DEMO"
            size="small"
            sx={{
              mr: 2,
              bgcolor: "#ffc107",
              color: "#000",
              fontWeight: 700,
            }}
          /> */}
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
              <Typography variant="body2">Demo User (admin)</Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Exit Demo
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

export default DemoLayout;
