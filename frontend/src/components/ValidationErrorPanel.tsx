import React from "react";
import {
  Box,
  Typography,
  Alert,
  AlertTitle,
  Collapse,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { ValidationResponse } from "../services/api";

interface ValidationErrorPanelProps {
  validation: ValidationResponse | null;
}

const ValidationErrorPanel: React.FC<ValidationErrorPanelProps> = ({
  validation,
}) => {
  if (!validation) return null;

  return (
    <Box sx={{ mb: 2 }}>
      {validation.errors.length > 0 && (
        <Alert severity="error" sx={{ mb: 1 }}>
          <AlertTitle>
            Validation Failed ({validation.errors.length} error
            {validation.errors.length > 1 ? "s" : ""})
          </AlertTitle>
          <List dense disablePadding>
            {validation.errors.map((e, i) => (
              <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" component="span">
                      <strong>{e.field}</strong>: {e.error}
                    </Typography>
                  }
                  secondary={e.suggestion || undefined}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
      {validation.warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          <AlertTitle>
            {validation.warnings.length} warning
            {validation.warnings.length > 1 ? "s" : ""}
          </AlertTitle>
          <List dense disablePadding>
            {validation.warnings.map((w, i) => (
              <ListItem key={i} disableGutters sx={{ py: 0.25 }}>
                <ListItemText
                  primary={
                    <Typography variant="body2" component="span">
                      <strong>{w.field}</strong>: {w.message}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}
    </Box>
  );
};

export default ValidationErrorPanel;
