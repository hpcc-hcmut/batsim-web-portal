import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Chip,
  Stack,
  Button,
} from "@mui/material";
import { Assessment } from "@mui/icons-material";
import { resultsAPI, Result } from "../services/api";

const ResultsPage: React.FC = () => {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await resultsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setResults(data);
      } catch (err: any) {
        setError("Failed to load results.");
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Results
      </Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : error ? (
        <Typography color="error" sx={{ mt: 4 }}>
          {error}
        </Typography>
      ) : results.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No results found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {results.map((r) => (
            <Grid item xs={12} sm={6} md={4} key={r.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Assessment sx={{ fontSize: 36, color: "#00e0d3" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {r.experiment_name || `Result #${r.id}`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {r.created_at?.split("T")[0]}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 2 }}
                    color="text.secondary"
                  >
                    {r.metrics
                      ? `Metrics: ${r.metrics}`
                      : "No metrics available."}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={r.scenario_name || "Scenario"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={r.strategy_name || "Strategy"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={`Jobs: ${r.completed_jobs ?? 0}/${
                        r.total_jobs ?? 0
                      }`}
                      size="small"
                      color="default"
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

export default ResultsPage;
