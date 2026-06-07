"use client";

import { Component, type ReactNode } from "react";

// A single malformed chart option or render error shouldn't white-screen the whole dashboard.
// This boundary catches render-time errors in its subtree and shows a compact, on-brand fallback
// so the rest of the page keeps working. `label` names the section in the fallback copy.

interface Props {
  children: ReactNode;
  label?: string;
  /** Optional custom fallback; receives the error. Falls back to the default card if omitted. */
  fallback?: (error: Error) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Keep a breadcrumb in the console; there's no server to report to (privacy-first, client-only).
    console.error(`[${this.props.label ?? "section"}] render error:`, error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error);

    return (
      <div className="card border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
        <p className="font-medium">
          This {this.props.label ?? "section"} couldn&apos;t be displayed.
        </p>
        <p className="mt-1 text-xs text-rose-300/80">
          The rest of your dashboard is unaffected. Try a different file or re-run the analysis.
        </p>
      </div>
    );
  }
}
