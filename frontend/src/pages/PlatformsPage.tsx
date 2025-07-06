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
import { Computer } from "@mui/icons-material";
import { platformsAPI, Platform } from "../services/api";

const PlatformsPage: React.FC = () => {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlatforms = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await platformsAPI.getAll();
        const data = Array.isArray(res.data)
          ? res.data
          : (res.data as any).items || [];
        setPlatforms(data);
      } catch (err: any) {
        setError("Failed to load platforms.");
      } finally {
        setLoading(false);
      }
    };
    fetchPlatforms();
  }, []);

  return (
    <Box>
      <Typography variant="h4" fontWeight={900} gutterBottom>
        Platforms
      </Typography>
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          href="/platforms/new"
          sx={{ borderRadius: 1, fontWeight: 700 }}
        >
          Upload New Platform
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
      ) : platforms.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 4 }}>
          No platforms found.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {platforms.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.id}>
              <Card
                sx={{
                  borderRadius: 1,
                  background: "rgba(26,32,44,0.98)",
                  height: "100%",
                }}
              >
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                    <Computer sx={{ fontSize: 36, color: "#4a9eff" }} />
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={900}
                        sx={{ color: "#fff" }}
                      >
                        {p.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {p.file_type?.toUpperCase() || "File"} •{" "}
                        {p.file_size
                          ? `${(p.file_size / 1024).toFixed(1)} KB`
                          : "Unknown size"}
                      </Typography>
                    </Box>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ mb: 2 }}
                    color="text.secondary"
                  >
                    {p.description || "No description provided."}
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Chip
                      label={p.file_type || "file"}
                      size="small"
                      color="secondary"
                    />
                    <Chip
                      label={p.created_at?.split("T")[0]}
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

export default PlatformsPage;
