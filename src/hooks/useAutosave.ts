import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

import { createAutosave, type Autosave } from '../lib/autosave/createAutosave';
import { formatClockTime } from '../lib/format/datetime';
import type { RootState } from '../store';
import { useStore } from '../store';

/* -------------------------------------------------------------------------- */
/* Mọi bộ tự lưu đang gắn — để Ctrl+S có ĐÚNG MỘT hệ để xả.                    */
/* -------------------------------------------------------------------------- */

/**
 * Các engine `createAutosave` đang sống, một mục cho mỗi hook đang gắn.
 *
 * Vỏ ứng dụng (`src/routes/router.tsx`) cần một lối "lưu ngay" cho Ctrl+S, mà
 * vỏ thì không biết dự án nào đang mở hay màn nào đang sửa cái gì. Cách sai là
 * cho vỏ dựng bộ tự lưu THỨ HAI của riêng nó: hai engine cùng theo dõi
 * `state.spatial` sẽ gửi hai lượt ghi cho mỗi thay đổi, đúng thứ lỗ hổng #7
 * ("một hệ tự lưu duy nhất") vừa được dọn. Nên vỏ không sở hữu engine nào —
 * nó xả engine mà màn đang mở đã dựng, qua {@link flushAutosaves}.
 *
 * `Set` chứ không phải một biến đơn: hai màn có thể cùng gắn (panel thanh tra
 * nằm bên trong một màn khác), và cả hai đều đáng được lưu khi người dùng bấm
 * Ctrl+S. Rỗng là chuyện bình thường — một màn không sửa gì thì không có gì
 * để xả, và {@link flushAutosaves} khi đó không làm gì.
 */
const mountedAutosaves = new Set<Autosave>();

/**
 * Lưu ngay mọi bộ tự lưu đang gắn, thay vì đợi hết cửa sổ 800 ms của A7.
 *
 * An toàn khi không có gì để lưu: `saveNow` của một engine không có thay đổi
 * nào sẽ giải quyết mà không gọi `onSave` lần nào. Trả về một `Promise` đợi
 * ĐỦ mọi lượt lưu, để nơi gọi (và bài kiểm) biết lượt xả đã xong.
 *
 * Đây là thứ Ctrl+S gọi. **Không** có nút Lưu nào được sinh ra kèm theo — A7
 * nói phím tắt là lối tắt của bộ đếm giờ, không phải một nút bấm mới.
 */
export function flushAutosaves(): Promise<void> {
  return Promise.all([...mountedAutosaves].map((autosave) => autosave.saveNow())).then(
    () => undefined,
  );
}

export interface UseAutosaveHandle {
  /**
   * The exact string this hook has always returned: `null` before the first
   * completed cycle, then `"Đã lưu lúc HH:mm"` or `"Lưu thất bại"`. Kept
   * byte-for-byte on purpose — `ConnectedSaveIndicator`
   * (`components/feedback/SaveIndicator.tsx:109`, outside this task's
   * whitelist) recognizes a failed save by exact string match
   * (`saveLabel === 'Lưu thất bại'`); the longer, friendlier failure copy in
   * `src/i18n/vi.json` (`autosave.failed`) belongs to `useSaveIndicator`
   * (`hooks/useSaveIndicator.ts`), a separate read-only view onto the same
   * engine, not to this one.
   */
  label: string | null;
  /**
   * Saves right now instead of waiting out the debounce window. Safe with
   * nothing pending — resolves without calling `onSave`. This is the export
   * `docs/contracts/property-inspector/commands.md` C8#7 found missing: with
   * nothing to call, Ctrl+S had nothing to do.
   */
  flush: () => Promise<void>;
}

/**
 * The engine shared by {@link useAutosave} and {@link useAutosaveFlush}: a
 * thin React face over `createAutosave`
 * (`src/lib/autosave/createAutosave.ts`), which is now the ONLY autosave
 * debounce implementation in the repo — this hook used to hand-roll its own
 * `setTimeout` (`AUTOSAVE_DEBOUNCE_MS`); it no longer does, and the 800 ms
 * figure itself is not written here — it is `createAutosave`'s own
 * `DEFAULT_DEBOUNCE_MS`, per invariant A7.
 *
 * Watches `state.spatial` directly, exactly as before: every existing caller
 * only supplies *where* a save goes
 * (`usePropertyInspector.ts:1059`, `useScaleCalibration.ts:625`,
 * `useDimensionOcrReview.ts:576`), never the data itself. A failed `onSave`
 * now runs through `createAutosave`'s own retry schedule
 * (`retrySchedule.ts`: 5s/15s/45s) and offline detection instead of flipping
 * straight to "Lưu thất bại" after one attempt.
 */
function useAutosaveHandle(onSave: (data: RootState['spatial']) => Promise<void>): UseAutosaveHandle {
  const spatial = useStore((state) => state.spatial);

  const spatialRef = useRef(spatial);
  spatialRef.current = spatial;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const autosave = useMemo<Autosave>(
    () =>
      createAutosave<NonNullable<RootState['spatial']>>({
        getChanges: () => spatialRef.current ?? undefined,
        // Returns the callback's own promise directly (no `async`/`await`
        // wrapper here) so a failing save rejects in the same number of
        // microtask turns as before this hook grew an engine underneath it.
        save: (changes) => onSaveRef.current(changes),
      }),
    [],
  );

  const state = useSyncExternalStore(autosave.subscribe, autosave.getState, autosave.getState);
  const [label, setLabel] = useState<string | null>(null);

  /* Ghi tên engine này vào sổ dùng chung suốt thời gian hook còn gắn, để Ctrl+S
     của vỏ xả được nó mà không cần biết màn nào đang mở. Gỡ tên khi tháo: một
     engine đã tháo không còn `getChanges` nào đọc được nữa. */
  useEffect(() => {
    mountedAutosaves.add(autosave);

    return () => {
      mountedAutosaves.delete(autosave);
    };
  }, [autosave]);

  useEffect(() => {
    if (!spatial) {
      return;
    }

    autosave.notifyChange();
  }, [spatial, autosave]);

  useEffect(() => {
    if (state === 'saved') {
      const lastSavedAt = autosave.getLastSavedAt();

      if (lastSavedAt !== undefined) {
        setLabel(`Đã lưu lúc ${formatClockTime(new Date(lastSavedAt))}`);
      }

      return;
    }

    if (state === 'failed') {
      setLabel('Lưu thất bại');
    }

    // 'dirty' | 'saving' | 'offline': sticky — the label already on screen
    // stays put, exactly as it did while the old hand-rolled timer counted
    // down (it only ever wrote a new label from inside its own callback).
  }, [state, autosave]);

  return { flush: autosave.saveNow, label };
}

/**
 * Invariant A7's autosave: waits for 800 ms of silence after the last store
 * change, then calls `onSave` with the current `state.spatial`. Signature and
 * return value are unchanged from before this file gained an engine
 * underneath it.
 */
export function useAutosave(onSave: (data: RootState['spatial']) => Promise<void>): string | null {
  return useAutosaveHandle(onSave).label;
}

/**
 * Same engine as {@link useAutosave}, plus `flush` for a caller that needs to
 * save on demand (a "before you leave" guard, a test that would rather not
 * wait out 800 ms) rather than only after the debounce window.
 *
 * Ctrl+S does **not** go through here: the shell has no `onSave` of its own to
 * pass, so it calls {@link flushAutosaves} and flushes whichever engine the
 * open screen already built. Use this one when the caller owns the save
 * target itself.
 */
export function useAutosaveFlush(onSave: (data: RootState['spatial']) => Promise<void>): UseAutosaveHandle {
  return useAutosaveHandle(onSave);
}
