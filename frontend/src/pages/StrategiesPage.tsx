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
import { Code } from "@mui/icons-material";
import { strategiesAPI, Strategy } from "../services/api";

const StrategiesPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStrategies = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await strategiesAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setStrategies(data);
      } catch (err: any) {
        setError("Failed to load strategies.");
      } finally {
        setLoading(false);
      }
    };
    fetchStrategies();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Strategies
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          href="/strategies/new"
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Upload New Strategy
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
      ) : strategies.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No strategies found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {strategies.map((s) => (
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
                    <Code sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {s.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {s.file_type?.toUpperCase() || "File"} •{" "}
                        {s.file_size
                          ? `${(s.file_size / 1024).toFixed(1)} KB`
                          : "Unknown size"}
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
                      label={s.file_type || "file"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={s.created_at?.split("T")[0]}
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

export default StrategiesPage;
