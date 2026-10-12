import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { UNDO_WINDOW_MS } from '../lib/mutations/undoTicket';

export interface UndoableToastState {
  isVisible: boolean;
  label: string;
  onUndo: () => void;
}

/**
 * Listens for new commits and shows an undoable toast for 8 seconds.
 *
 * The undo comes from the commit itself (`historySlice.lastCommitUndo`), not
 * from zundo's `temporal`. The hook used to call `temporal.undo()` for whatever
 * label it saw, and `temporal` only tracks `spatial` (`store/index.ts`,
 * `partialize`): a rule-configuration commit — `commitRuleConfig`, which the
 * rule settings screen fires on load — therefore raised a toast whose Undo
 * button rolled back the user's last wall edit and left the configuration
 * exactly as it was. A8 says every change is undoable, not that one button
 * undoes every kind of change.
 *
 * A commit that hands over no undo raises no toast: a visible Undo that does
 * nothing is worse than no Undo at all.
 *
 * Only commits made after mount count. Each route that mounts its own
 * `Toast.Provider` (/versions, export, project settings, dashboard, account)
 * used to replay the store's last commit on arrival — an old wall edit showed
 * "Hoàn tác" on /versions and its Undo ran `temporal.undo()` there. The commit
 * present at mount is recognised by its undo closure, which `commit()` and
 * `commitRuleConfig` create fresh per commit (a timestamp can repeat within a
 * millisecond).
 */
export function useUndoableToast(): UndoableToastState | null {
  const lastCommitLabel = useStore((state) => state.lastCommitLabel);
  const lastCommitTimestamp = useStore((state) => state.lastCommitTimestamp);
  const lastCommitUndo = useStore((state) => state.lastCommitUndo);

  const [toast, setToast] = useState<UndoableToastState | null>(null);
  const undoAtMount = useRef(lastCommitUndo);

  useEffect(() => {
    if (lastCommitLabel && lastCommitTimestamp && lastCommitUndo && lastCommitUndo !== undoAtMount.current) {
      setToast({
        isVisible: true,
        label: lastCommitLabel,
        onUndo: () => {
          lastCommitUndo();
          setToast(null); // hide on undo
        },
      });

      const timer = setTimeout(() => {
        setToast((current) => current?.label === lastCommitLabel ? { ...current, isVisible: false } : current);
      }, UNDO_WINDOW_MS);

      return () => clearTimeout(timer);
    }
  }, [lastCommitLabel, lastCommitTimestamp, lastCommitUndo]);

  return toast;
}
