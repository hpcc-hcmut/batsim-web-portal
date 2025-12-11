import React, { useEffect, useState } from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Switch,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  Alert,
  Tooltip,
  IconButton,
  CircularProgress,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import {
  PredictionMode,
  PredictionModel,
  predictionsAPI,
} from "../services/api";

interface PredictionConfigProps {
  enabled: boolean;
  modelId: number | null;
  mode: PredictionMode;
  onEnabledChange: (enabled: boolean) => void;
  onModelChange: (modelId: number | null) => void;
  onModeChange: (mode: PredictionMode) => void;
}

const modeDescriptions: Record<PredictionMode, string> = {
  no_prediction: "Use original walltime from workload (default behavior)",
  prediction_only: "Replace walltime with ML-predicted duration",
  hybrid: "Keep original walltime and add predicted_duration field",
};

export const PredictionConfig: React.FC<PredictionConfigProps> = ({
  enabled,
  modelId,
  mode,
  onEnabledChange,
  onModelChange,
  onModeChange,
}) => {
  const [models, setModels] = useState<PredictionModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        const response = await predictionsAPI.getModels(true);
        setModels(response.data);
        setError(null);
      } catch (err) {
        setError("Failed to load prediction models");
        console.error("Error fetching prediction models:", err);
      } finally {
        setLoading(false);
      }
    };

    if (enabled) {
      fetchModels();
    }
  }, [enabled]);

  return (
    <Box sx={{ mt: 2, p: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
      <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: "bold", flexGrow: 1 }}>
          Prediction Configuration
        </Typography>
        <Tooltip title="ML-based job duration prediction transforms workloads before simulation, allowing schedulers to make better decisions based on predicted durations.">
          <IconButton size="small">
            <InfoIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            color="primary"
          />
        }
        label="Enable Prediction"
      />

      {enabled && (
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel id="prediction-model-label">Prediction Model</InputLabel>
            <Select
              labelId="prediction-model-label"
              value={modelId ?? ""}
              label="Prediction Model"
              onChange={(e) =>
                onModelChange(e.target.value ? Number(e.target.value) : null)
              }
              disabled={loading}
            >
              <MenuItem value="">
                <em>Mock Prediction (default)</em>
              </MenuItem>
              {loading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  Loading models...
                </MenuItem>
              ) : (
                models.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name} ({model.model_type})
                    {model.accuracy && ` - {(model.accuracy * 100).toFixed(1)}% accuracy`}
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>

          <FormControl component="fieldset">
            <FormLabel component="legend">Prediction Mode</FormLabel>
            <RadioGroup
              value={mode}
              onChange={(e) => onModeChange(e.target.value as PredictionMode)}
            >
              <FormControlLabel
                value="no_prediction"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">No Prediction</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {modeDescriptions.no_prediction}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="prediction_only"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Prediction Only</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {modeDescriptions.prediction_only}
                    </Typography>
                  </Box>
                }
              />
              <FormControlLabel
                value="hybrid"
                control={<Radio />}
                label={
                  <Box>
                    <Typography variant="body2">Hybrid Mode</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {modeDescriptions.hybrid}
                    </Typography>
                  </Box>
                }
              />
            </RadioGroup>
          </FormControl>

          {mode !== "no_prediction" && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Predictions will be applied during simulation preparation. The
              transformed workload will be stored alongside the original.
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
};

export default PredictionConfig;
