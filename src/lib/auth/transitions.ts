import { clearNavigationMemory } from './navigationMemory';
import { forgetDeviceSession, setAnonymousSession } from './state';
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
  clearNavigationMemory();
  // Đăng xuất chủ động: lần mở sau là khách, không phải "phiên đã kết thúc" (U59).
  if (reason === 'sign-out') {
    forgetDeviceSession();
  }
  setAnonymousSession({ refreshFailed });
  emitSignedOut(reason ? { reason, source } : { source });
};

