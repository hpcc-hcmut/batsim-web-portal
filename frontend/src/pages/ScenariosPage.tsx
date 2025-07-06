import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Button,
  Stack,
  Chip,
} from "@mui/material";
import { Settings } from "@mui/icons-material";
import { scenariosAPI, Scenario } from "../services/api";

const ScenariosPage: React.FC = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScenarios = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await scenariosAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setScenarios(data);
      } catch (err: any) {
        setError("Failed to load scenarios.");
      } finally {
        setLoading(false);
      }
    };
    fetchScenarios();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Scenarios
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          href="/scenarios/new"
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Create Scenario
        </Button>
      </Box>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : error ? (
        <Typography color="error" sx={{ mt: 4 }}>
          {error}
        </Typography>
      ) : scenarios.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No scenarios found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {scenarios.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Settings sx={{ fontSize: 36, color: "#00e0d3" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {s.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Workload: {s.workload_name || "-"} | Platform:{" "}
                        {s.platform_name || "-"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 2 }}
                    color="text.secondary"
                  >
                    {s.description || "No description provided."}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={s.created_at?.split("T")[0]}
                      size="small"
                      color="default"
                    />
                    <Chip
                      label={s.creator_username || "user"}
                      size="small"
                      color="secondary"
                    />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
};

export default ScenariosPage;
