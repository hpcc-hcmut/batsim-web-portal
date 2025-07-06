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
import { Science } from "@mui/icons-material";
import { experimentsAPI, Experiment } from "../services/api";

const ExperimentsPage: React.FC = () => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExperiments = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await experimentsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setExperiments(data);
      } catch (err: any) {
        setError("Failed to load experiments.");
      } finally {
        setLoading(false);
      }
    };
    fetchExperiments();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Experiments
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          href="/experiments/new"
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Start New Experiment
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
      ) : experiments.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No experiments found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {experiments.map((e) => (
            <Grid item xs={12} sm={6} md={4} key={e.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Science sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {e.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Status: {e.status}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 2 }}
                    color="text.secondary"
                  >
                    {e.description || "No description provided."}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={e.created_at?.split("T")[0]}
                      size="small"
                      color="default"
                    />
                    <Chip
                      label={e.scenario_name || "Scenario"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={e.strategy_name || "Strategy"}
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

export default ExperimentsPage;
