import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

type Props = {
  children: ReactNode;
  /** Optional label written into the report context. */
  boundary?: string;
  /** Optional custom fallback renderer. */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
};

type State = { error: Error | null };

/**
 * Client-side error boundary for pages inside a shell (OwnerShell, ChefShell, …).
 * Catches render / lifecycle errors below it so a single broken widget cannot
 * blank out the whole app. The root route already has its own boundary; this
 * one keeps the chrome (sidebar, header) intact.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[cafeos] page boundary", error, info);
    try {
      reportLovableError(error, {
        boundary: this.props.boundary ?? "page_error_boundary",
        componentStack: info.componentStack ?? undefined,
      });
    } catch {
      /* never let the reporter break the fallback */
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback({ error, reset: this.reset });
    }

    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h2 className="mt-3 text-base font-semibold">This section couldn't load</h2>
        <p className="mt-1 text-sm text-muted-foreground break-words">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={this.reset} size="sm">
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Try again
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}
