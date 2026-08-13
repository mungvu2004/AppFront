export interface GuardBeforeUnloadOptions {
  hasUnsavedChanges: () => boolean;
  sendBeacon: () => void;
  windowObject?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
}

export type StopGuardingBeforeUnload = () => void;

const resolveWindowObject = (): Pick<Window, 'addEventListener' | 'removeEventListener'> | undefined =>
  typeof window === 'undefined' ? undefined : window;

/**
 * Wires `window`'s `beforeunload` event so an unsaved change gets one last
 * best-effort save via `sendBeacon` (fire-and-forget, since the page may be
 * gone before a normal request would finish) and the browser shows its
 * native leave-site warning. Does nothing, and blocks nothing, when there is
 * no unsaved change.
 */
export function guardBeforeUnload(options: GuardBeforeUnloadOptions): StopGuardingBeforeUnload {
  const windowObject = options.windowObject ?? resolveWindowObject();

  const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!options.hasUnsavedChanges()) {
      return;
    }

    options.sendBeacon();
    event.preventDefault();
    event.returnValue = '';
  };

  windowObject?.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    windowObject?.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
