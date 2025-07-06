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
import { Storage } from "@mui/icons-material";
import { workloadsAPI, Workload } from "../services/api";

const WorkloadsPage: React.FC = () => {
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkloads = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await workloadsAPI.getAll();
        setWorkloads(res.data);
      } catch (err: any) {
        setError("Failed to load workloads.");
      } finally {
        setLoading(false);
      }
    };
    fetchWorkloads();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Workloads
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          href="/workloads/new"
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Upload New Workload
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
      ) : workloads.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No workloads found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {workloads.map((w) => (
            <Grid item xs={12} sm={6} md={4} key={w.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Storage sx={{ fontSize: 36, color: "#00e0d3" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {w.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {w.file_type?.toUpperCase() || "File"} •{" "}
                        {w.file_size
                          ? `${(w.file_size / 1024).toFixed(1)} KB`
                          : "Unknown size"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 2 }}
                    color="text.secondary"
                  >
                    {w.description || "No description provided."}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={w.file_type || "file"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={w.created_at?.split("T")[0]}
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

export default WorkloadsPage;
