import { setAnonymousSession } from './state';
import type { AuthEventDetail } from './types';

export const endAnonymousSession = ({
  clearTimer,
  emitSignedOut,
  reason,
  refreshFailed,
  source,
}: {
  clearTimer: () => void;
  emitSignedOut: (detail: AuthEventDetail) => void;
  reason: AuthEventDetail['reason'];
  refreshFailed: boolean;
  source: AuthEventDetail['source'];
}): void => {
  clearTimer();
  setAnonymousSession({ refreshFailed });
  emitSignedOut({ reason, source });
};
