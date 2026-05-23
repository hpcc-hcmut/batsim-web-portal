import { Component, ReactNode, ErrorInfo } from "react";
import { Alert, AlertTitle, Box, Button, Stack } from "@mui/material";

interface Props {
  children: ReactNode;
  // Optional label shown in the fallback so per-page boundaries can identify themselves
  scope?: string;
  // Optional override fallback render — defaults to the built-in error card
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Reset-loop guard: if the same boundary catches an error >MAX_RESETS times within
// one mount, stop offering "try again" and ask the user to reload — keeps a buggy
// component from trapping the user in a click→crash→reset→crash loop.
const MAX_RESETS = 3;

/**
 * Crash safety net so a render failure in one subtree (e.g. Gantt canvas, log viewer)
 * doesn't blank the whole app during a defense demo. Wrap `<App>` at the root and
 * optionally per-page where a localised fallback gives a better recovery path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };
  private resetCount = 0;

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Log to console so devtools shows the stack; production hook could ship to monitoring.
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.scope ? `:${this.props.scope}` : ""}]`, error, info);
  }

  reset = (): void => {
    if (this.resetCount >= MAX_RESETS) {
      // Bail out of the reset-attempt loop — hard reload gives the user a clean slate.
      window.location.reload();
      return;
    }
    this.resetCount += 1;
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }
    const err = this.state.error;
    if (this.props.fallback && err) {
      return this.props.fallback(err, this.reset);
    }
    const exhausted = this.resetCount >= MAX_RESETS;
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" variant="outlined">
          <AlertTitle>
            Đã xảy ra lỗi khi hiển thị {this.props.scope ?? "nội dung này"}
          </AlertTitle>
          {err?.message ?? "Unknown error"}
          {exhausted && (
            <Box sx={{ mt: 1, fontSize: 12, color: "text.secondary" }}>
              Đã thử lại {MAX_RESETS} lần không thành công — vui lòng tải lại trang.
            </Box>
          )}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              size="small"
              variant="contained"
              color="primary"
              onClick={this.reset}
              disabled={exhausted}
            >
              Thử lại
            </Button>
            <Button size="small" variant="outlined" onClick={() => window.location.reload()}>
              Tải lại trang
            </Button>
          </Stack>
        </Alert>
      </Box>
    );
  }
}
