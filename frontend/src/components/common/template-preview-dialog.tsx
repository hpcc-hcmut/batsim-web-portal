import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Close, ContentCopy, Download, Check } from "@mui/icons-material";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import { templatesAPI } from "../../services/api";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("markup", markup);

export type TemplateType = "workload" | "platform" | "strategy";

const TEMPLATE_META: Record<
  TemplateType,
  { title: string; language: string; filename: string }
> = {
  strategy: {
    title: "Strategy Template (FCFS, annotated)",
    language: "python",
    filename: "strategy_template.py",
  },
  workload: {
    title: "Workload Template",
    language: "json",
    filename: "workload-template.json",
  },
  platform: {
    title: "Platform Template",
    language: "markup",
    filename: "platform-template.xml",
  },
};

interface TemplatePreviewDialogProps {
  open: boolean;
  onClose: () => void;
  type: TemplateType;
}

/**
 * Read-only preview of a starter template with Copy + Download actions.
 * Backed by GET /api/templates/{type}; content is fetched lazily on open.
 */
export const TemplatePreviewDialog: React.FC<TemplatePreviewDialogProps> = ({
  open,
  onClose,
  type,
}) => {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const meta = TEMPLATE_META[type];

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    templatesAPI
      .getContent(type)
      .then((res) => setContent(res.data))
      .catch(() => setError("Could not load template content."))
      .finally(() => setLoading(false));
  }, [open, type]);

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy to clipboard failed. Use Download instead.");
    }
  };

  const handleDownload = () => {
    // Content-Disposition on the endpoint triggers a file download
    window.open(templatesAPI.download(type), "_blank");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
        <Box sx={{ flex: 1 }}>{meta.title}</Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : error ? (
          <Alert severity="warning" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : content ? (
          <Box sx={{ maxHeight: 480, overflow: "auto" }}>
            <SyntaxHighlighter
              language={meta.language}
              style={oneDark}
              showLineNumbers
              customStyle={{ margin: 0, fontSize: 12 }}
              wrapLongLines
            >
              {content}
            </SyntaxHighlighter>
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
          <Button
            startIcon={copied ? <Check /> : <ContentCopy />}
            onClick={handleCopy}
            disabled={!content}
            color={copied ? "success" : "primary"}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        </Tooltip>
        <Button startIcon={<Download />} onClick={handleDownload} variant="outlined">
          Download {meta.filename}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TemplatePreviewDialog;
