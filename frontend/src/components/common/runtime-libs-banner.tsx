import { useCallback, useEffect, useState } from "react";
import { Alert, AlertTitle, Chip, IconButton, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import axios from "axios";
import { systemAPI, RuntimeInfo, RuntimeManifestError } from "../../services/api";

/**
 * Informational banner shown above the Strategies list — tells researchers which Python
 * version + libraries are available inside the PyBatSim container so they don't ship a
 * strategy with `import tensorflow` only to hit ImportError at simulation start.
 *
 * Backend returns 503 when the extended image hasn't been built yet; in that case we
 * surface the operator-actionable hint instead of pretending the manifest is just empty.
 */
export function RuntimeLibsBanner() {
  const [info, setInfo] = useState<RuntimeInfo | null>(null);
  const [error, setError] = useState<RuntimeManifestError | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual refresh — banner doesn't auto-poll (image rarely rebuilt during a session)
  // but if admin does rebuild mid-defense, this button avoids a full page reload.
  const fetchRuntime = useCallback(async (signal: { cancelled: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await systemAPI.getRuntime();
      if (!signal.cancelled) setInfo(res.data);
    } catch (e: unknown) {
      if (signal.cancelled) return;
      setInfo(null);
      if (axios.isAxiosError(e) && e.response?.status === 503) {
        const detail = e.response.data?.detail;
        if (detail && typeof detail === "object") {
          setError(detail as RuntimeManifestError);
          return;
        }
      }
      setError({
        error: "runtime_manifest_unavailable",
        message: "Cannot reach /system/runtime",
        configured_path: "",
        tried_paths: [],
      });
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    fetchRuntime(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [fetchRuntime]);

  const handleRefresh = () => {
    const signal = { cancelled: false };
    fetchRuntime(signal);
  };

  if (loading && !info && !error) {
    return <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />;
  }

  const refreshBtn = (
    <Tooltip title="Refresh">
      <span>
        <IconButton size="small" onClick={handleRefresh} disabled={loading}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  );

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }} variant="outlined" action={refreshBtn}>
        <AlertTitle>PyBatSim runtime manifest unavailable</AlertTitle>
        <Typography variant="body2">{error.message}</Typography>
        {error.hint && (
          <Typography variant="caption" color="text.secondary">
            {error.hint}
          </Typography>
        )}
      </Alert>
    );
  }

  if (!info) return null;

  return (
    <Alert severity="info" sx={{ mb: 2 }} variant="outlined" icon={false} action={refreshBtn}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
        <Typography variant="body2" fontWeight={600}>
          PyBatSim runtime: Python {info.python_version} · pybatsim {info.pybatsim_version}
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
          {info.available_libs.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Only stdlib available — no extra libraries installed.
            </Typography>
          )}
          {info.available_libs.map((lib) => (
            <Chip
              key={lib.name}
              label={`${lib.name} ${lib.version}`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: 11 }}
            />
          ))}
        </Stack>
      </Stack>
      {info.policy && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          {info.policy}
        </Typography>
      )}
    </Alert>
  );
}
