import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Box } from "@mui/material";
import useAuthStore from "./store/authStore";

// Components
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import WorkloadsPage from "./pages/WorkloadsPage";
import PlatformsPage from "./pages/PlatformsPage";
import ScenariosPage from "./pages/ScenariosPage";
import StrategiesPage from "./pages/StrategiesPage";
import ExperimentsPage from "./pages/ExperimentsPage";
import ResultsPage from "./pages/ResultsPage";
import AnalyticsPage from "./pages/AnalyticsPage";

// Add Inter font import to the document head
if (typeof document !== "undefined") {
  const fontLink = document.createElement("link");
  fontLink.href =
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap";
  fontLink.rel = "stylesheet";
  document.head.appendChild(fontLink);
}

// Create theme
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#4a9eff",
      contrastText: "#0a0f1a",
    },
    secondary: {
      main: "#2d3748",
      contrastText: "#e2e8f0",
    },
    background: {
      default: "#0a0f1a",
      paper: "#1a202c",
    },
    text: {
      primary: "#e2e8f0",
      secondary: "#a0aec0",
    },
  },
  shape: {
    borderRadius: 1,
  },
  typography: {
    fontFamily: 'Inter, Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.5px",
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          backgroundColor: "#1a202c",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 4px 20px 0 rgba(0,0,0,0.25)",
          background: "linear-gradient(135deg, #2d3748 0%, #1a202c 100%)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "linear-gradient(160deg, #2d3748 0%, #0a0f1a 100%)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "rgba(26, 32, 44, 0.95)",
          boxShadow: "0 2px 8px 0 rgba(0,0,0,0.15)",
        },
      },
    },
  },
});

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const App: React.FC = () => {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box
          sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="workloads" element={<WorkloadsPage />} />
              <Route path="platforms" element={<PlatformsPage />} />
              <Route path="scenarios" element={<ScenariosPage />} />
              <Route path="strategies" element={<StrategiesPage />} />
              <Route path="experiments" element={<ExperimentsPage />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
            </Route>
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
};

export default App;
