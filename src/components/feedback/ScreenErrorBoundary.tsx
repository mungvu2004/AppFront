import { Component, type ReactNode } from 'react';

import {
  createScreenErrorRecorder,
  describeScreenError,
  type ScreenErrorReport,
} from '@/lib/screen-state/screenErrorBoundary';

/**
 * The React shell of a screen error boundary. It decides nothing.
 *
 * A crashed screen must not take the application with it, and catching a throw
 * during render is something only a class component can do — `getDerivedStateFromError`
 * has no hook equivalent. That lifecycle is the entire reason this file exists.
 * Everything else — classifying the failure, wording it in Vietnamese, deciding
 * whether retrying is worth offering, keeping telemetry honest — is in
 * `@/lib/screen-state/screenErrorBoundary`, where it is a function and can be
 * tested without a DOM.
 *
 * The file lives under `src/components` rather than beside its logic because
 * `src/lib/**` may not import React, by the import boundary in section 0.4 and
 * by invariant D. That rule is not in the way here, it is correct: a class
 * component is a view, and this is the smallest one in the codebase.
 *
 * **It builds no interface of its own.** There is no JSX in this file. When a
 * screen breaks, the boundary calls the `renderFallback` function it was given
 * and returns whatever that returns, so what a broken screen looks like stays a
 * decision for the screen — and so this component owns no colour, no token and
 * no copy.
 *
 * @example
 * <ScreenErrorBoundary
 *   screenId="qc"
 *   renderFallback={({ report, retry }) => (
 *     <ErrorState description={report.description} onRetry={report.retryable ? retry : undefined} />
 *   )}
 * >
 *   <QcScreen />
 * </ScreenErrorBoundary>
 */

/** What the caller is handed when the screen has broken. */
export interface ScreenErrorFallback {
  /** The classified error, its Vietnamese wording, and whether a retry is worth offering. */
  readonly report: ScreenErrorReport;
  /** Clears the error and mounts the children again. */
  readonly retry: () => void;
}

export interface ScreenErrorBoundaryProps {
  /** Names this screen in telemetry, e.g. `'qc'`, `'upload'`. */
  readonly screenId: string;
  readonly children: ReactNode;
  /** Builds what a person sees instead of the screen. The boundary draws nothing itself. */
  readonly renderFallback: (fallback: ScreenErrorFallback) => ReactNode;
  /** Told after the error has been recorded, for a screen that wants to react to it. */
  readonly onError?: (report: ScreenErrorReport) => void;
}

interface ScreenErrorBoundaryState {
  readonly report: ScreenErrorReport | null;
}

export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, ScreenErrorBoundaryState> {
  public override state: ScreenErrorBoundaryState = { report: null };

  private readonly recorder = createScreenErrorRecorder(this.props.screenId);

  /**
   * React may call this more than once for a single throw, so it only computes;
   * `describeScreenError` is pure and records nothing. Telemetry happens in
   * `componentDidCatch`, which runs once.
   */
  public static getDerivedStateFromError(error: unknown): ScreenErrorBoundaryState {
    return { report: describeScreenError(error) };
  }

  public override componentDidCatch(error: unknown): void {
    const report = this.recorder.receive(error, { screenId: this.props.screenId });

    this.props.onError?.(report);
  }

  /**
   * Drop the error and try the screen again.
   *
   * The recorder is reset first, so if the screen breaks the same way a second
   * time that failure is recorded as its own event rather than being mistaken
   * for the one already reported.
   */
  private readonly retry = (): void => {
    this.recorder.reset();
    // eslint-disable-next-line local/no-direct-set -- React's own component state, not the zustand store; invariant A10 is about commit(patch, label).
    this.setState({ report: null });
  };

  public override render(): ReactNode {
    const { report } = this.state;

    if (report === null) {
      return this.props.children;
    }

    return this.props.renderFallback({ report, retry: this.retry });
  }
}
