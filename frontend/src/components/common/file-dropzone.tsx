import React, { useRef, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  FormHelperText,
} from "@mui/material";
import {
  CloudUploadOutlined,
  InsertDriveFile,
  Clear,
} from "@mui/icons-material";

export interface FileDropzoneProps {
  accept: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

/** Returns "NNN KB" below 1024 KB, otherwise "NN.N MB" */
function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * Validate a file's extension against an accept string (comma-separated).
 * Returns true if accepted, false otherwise.
 */
function isExtensionAccepted(fileName: string, accept: string): boolean {
  if (!accept.trim()) return true;
  const ext = "." + fileName.split(".").pop()?.toLowerCase();
  return accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .some((a) => a === ext || a === fileName.toLowerCase());
}

const FileDropzone: React.FC<FileDropzoneProps> = ({
  accept,
  file,
  onFileChange,
  label,
  hint,
  required = false,
  disabled = false,
  id,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [extensionError, setExtensionError] = useState<string | null>(null);

  const handleContainerClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setExtensionError(null);
    onFileChange(selected);
    // Reset so the same file can be re-selected after clearing
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!isExtensionAccepted(dropped.name, accept)) {
      setExtensionError(
        `File type not accepted. Expected: ${accept}`
      );
      return;
    }
    setExtensionError(null);
    onFileChange(dropped);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    setExtensionError(null);
    onFileChange(null);
  };

  // Shared container sx
  const containerSx = {
    border: "2px dashed",
    borderColor: isDragOver
      ? "primary.main"
      : "divider",
    borderRadius: 1,
    minHeight: 120,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    p: 2,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    bgcolor: isDragOver ? "rgba(74,158,255,0.06)" : "transparent",
    transition: "border-color 0.15s, background-color 0.15s",
    "&:focus-visible": {
      outline: "2px solid",
      outlineColor: "primary.main",
    },
  };

  return (
    <Box sx={{ mb: 0 }}>
      {/* Hidden native file input for click-to-browse + a11y. Note: no
          `required` attribute - drag-and-drop fills React state without
          populating the native input's files, which would silently block
          form submission. The parent form already validates via React state. */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        disabled={disabled}
        style={{ display: "none" }}
        onChange={handleInputChange}
        aria-label={label}
      />

      <Box
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        sx={containerSx}
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {file ? (
          /* File-selected state: pill row */
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              width: "100%",
              px: 1,
            }}
          >
            <InsertDriveFile sx={{ color: "primary.main", flexShrink: 0 }} />
            <Typography
              variant="body2"
              sx={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: "text.primary",
              }}
              title={file.name}
            >
              {file.name}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, mr: 0.5 }}
            >
              {formatFileSize(file.size)}
            </Typography>
            <IconButton
              size="small"
              onClick={handleClear}
              disabled={disabled}
              aria-label="Clear file"
              sx={{ flexShrink: 0 }}
            >
              <Clear fontSize="small" />
            </IconButton>
          </Box>
        ) : (
          /* Idle / drag-over state */
          <>
            <CloudUploadOutlined
              sx={{ fontSize: 36, color: "text.disabled", mb: 0.5 }}
            />
            <Typography variant="body2" color="text.secondary">
              Drop file here or click to browse
              {required && (
                <Box component="span" sx={{ color: "error.main", ml: 0.5 }}>
                  *
                </Box>
              )}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.disabled">
                {hint}
              </Typography>
            )}
          </>
        )}
      </Box>

      {extensionError && (
        <FormHelperText error>{extensionError}</FormHelperText>
      )}
    </Box>
  );
};

export default FileDropzone;
