/**
 * The core of a screen error boundary, with no React in it.
 *
 * A boundary has two jobs and only one of them needs React. Deciding *what a
 * broken screen means* — which kind of failure it was, what to tell the person
 * in Vietnamese, whether trying again is worth their time, and getting it into
 * telemetry exactly once — is arithmetic on an unknown value. Catching the throw
 * is the only part React has to do, and `getDerivedStateFromError` is four lines.
 *
 * So the decision lives here, where it can be tested by calling a function, and
 * `src/components/feedback/ScreenErrorBoundary` is the shell that wires a React
 * lifecycle to it. That split is invariant D, and it is also the only split the
 * import boundary allows: `src/lib/**` may not import React at all.
 *
 * Two promises this module makes, both of them constraints rather than nice
 * behaviour:
 *
 * - **Nothing is swallowed.** Every error handed to a recorder reaches
 *   `reportError`. If telemetry itself fails, the error still goes to the
 *   console rather than disappearing — a boundary that quietly eats a crash is
 *   worse than no boundary, because the screen is blank and nobody is told why.
 * - **Nothing is recorded twice.** React may ask for the fallback state more
 *   than once for a single throw. Recording is keyed on the error itself, so one
 *   crash is one telemetry event, and the count in a dashboard means what a
 *   reader thinks it means.
 *
 * Nothing here reads the store, and nothing here builds an interface.
 */

import { describeError, reportError, toAppError } from '@/lib/errors';
import type { AppError, ErrorDescription, ErrorTelemetryContext } from '@/lib/errors';

/**
 * What a broken screen has to offer: the classified error, the Vietnamese words
 * for it, and whether trying again is worth a click.
 */
export interface ScreenErrorReport {
  /** The failure, classified into one of the application's error kinds. */
  readonly appError: AppError;
  /** Title, body and button labels, already in Vietnamese. */
  readonly description: ErrorDescription;
  /** Whether this kind of failure is worth a second attempt. */
  readonly retryable: boolean;
}

/**
 * Keeps one screen's crash out of telemetry twice.
 *
 * Instances rather than a module-level flag: two screens can be broken at once,
 * and one of them recovering must not stop the other from being recorded.
 */
export interface ScreenErrorRecorder {
  /**
   * Classify an error, record it, and describe it.
   *
   * Called again with the *same* error, it describes it again but records
   * nothing — see the module docblock. Call {@link ScreenErrorRecorder.reset}
   * when the user tries again, so the next failure counts as new.
   */
  receive: (error: unknown, context?: ErrorTelemetryContext) => ScreenErrorReport;
  /** Forget the error being held, so a repeat of it is recorded again. */
  reset: () => void;
}

/** Sentinel for "no error has been recorded yet", distinct from any thrown value. */
const NOTHING_RECORDED = Symbol('screenErrorBoundary/nothingRecorded');

/**
 * Classify and describe an error without recording it.
 *
 * Pure, and that matters: React's `getDerivedStateFromError` may run more than
 * once for a single throw, so the function it calls must have no side effect.
 * Recording is {@link ScreenErrorRecorder.receive}'s job, driven from
 * `componentDidCatch`, which runs once.
 */
export function describeScreenError(error: unknown): ScreenErrorReport {
  const appError = toAppError(error);

  return {
    appError,
    description: describeError(appError),
    retryable: appError.retryable,
  };
}

/**
 * Send an error to telemetry, and refuse to fail quietly if that does not work.
 *
 * `reportError` dispatches an event and does not throw in any case we know of,
 * but a listener that throws during dispatch, or a runtime with no `window` and
 * no `EventTarget`, would turn a crash report into silence. The console is the
 * last channel that is always there.
 */
function recordOrShout(error: unknown, context: ErrorTelemetryContext): void {
  try {
    reportError(error, context);
  } catch (reportingFailure) {
    // The console is the last channel left; losing the crash entirely is worse.
    console.error('screen-state: không ghi nhận được lỗi màn hình.', error, reportingFailure);
  }
}

/**
 * A recorder for one screen.
 *
 * @param screenId Identifies the screen in telemetry, e.g. `'qc'`, `'upload'`.
 *
 * @example
 * const recorder = createScreenErrorRecorder('qc');
 * const report = recorder.receive(caught);
 * report.description.title;   // "Mất kết nối"
 * recorder.receive(caught);   // described again, recorded no further
 */
export function createScreenErrorRecorder(screenId: string): ScreenErrorRecorder {
  let recorded: unknown = NOTHING_RECORDED;

  return {
    receive: (error, context = {}) => {
      if (!Object.is(recorded, error)) {
        recorded = error;
        recordOrShout(error, { ...context, screenId });
      }

      return describeScreenError(error);
    },
    reset: () => {
      recorded = NOTHING_RECORDED;
    },
  };
}
