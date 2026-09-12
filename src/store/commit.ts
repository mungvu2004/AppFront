import { useStore } from './index';
import type { RootState } from './index';
import { draftEntityId, type EditEntityDraft } from './draftSlice';
import { MERGE_WINDOW_MS } from '../lib/commands/mergeCommands';
import type { SpatialPatch } from '../domain/spatial/applyPatch';
import type { SpatialEntity } from '../domain/spatial/normalize';
import type { EntityId } from '../domain/spatial/types';

export interface CommitResult {
  undo: () => void;
  label: string;
  timestamp: number;
}

/* -------------------------------------------------------------------------- */
/* One drag, one undo step.                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The two undo stacks used to disagree, and the user felt it.
 *
 * `MERGE_WINDOW_MS` (= `COALESCE_WINDOW_MS`) folds a run of same-kind edits
 * into one command in `lib/commands/history`, but the undo the application
 * actually performs is zundo's `temporal` on the store, and zundo had never
 * heard of that window: two writes 200 ms apart — well inside the 400 ms run —
 * left two zundo steps, so one Ctrl+Z gave back half a drag.
 *
 * The fold happens here rather than in a `handleSet` option on `temporal`
 * because the window is a **command-layer** rule, and `commit` is the command
 * layer's only door into the store (invariant A10). A `handleSet` throttle sees
 * every write to `spatial` with no idea where it came from, so it would also
 * fold a test seeding the graph together with the first edit that follows it,
 * and fold two unrelated edits that merely landed in the same tick. What is
 * folded has to be what `canMergeCommands` folds: the same operation, on the
 * same entities, over the same fields, close enough in time — and nothing else
 * touching the graph in between.
 *
 * Suppression uses zundo's own `pause`/`resume`, not a hand-rolled timer: the
 * continuing write still happens, it just does not open a new past state, so
 * the step the run started with stays the one undo returns to. Which is the
 * same thing `mergeCommands` keeps — the **first** command's `before`.
 */
interface OpenRun {
  /** What the run is: same op, same entities, same fields. */
  readonly key: string;
  /** When the run's most recent write landed; the gap is measured from here. */
  readonly at: number;
  /** The graph the run left behind, so a foreign write closes the run. */
  readonly spatial: RootState['spatial'];
}

let openRun: OpenRun | null = null;

/** One patch as its identity: what it does, to what, to which fields. */
const patchKey = (patch: SpatialPatch): string => {
  if (patch.op === 'add') {
    return `add:${patch.kind}:${patch.entity.id}`;
  }

  if (patch.op === 'remove') {
    return `remove:${patch.kind}:${patch.id}`;
  }

  return `update:${patch.kind}:${patch.id}:${Object.keys(patch.changes).sort().join(',')}`;
};

const runKey = (patches: readonly SpatialPatch[]): string => patches.map(patchKey).join('|');

/**
 * Does this write continue the run that is already open?
 *
 * The gap is measured against the previous write, not the start of the run —
 * the rule `canMergeCommands` uses — so a continuous drag folds however long it
 * lasts and a pause of `MERGE_WINDOW_MS` closes it. The graph identity is the
 * fourth condition: anything else that wrote to `spatial` in between (a screen
 * seeding it, an undo, another commit) means the run is over, whatever the
 * clock says.
 */
const continuesRun = (key: string, timestamp: number, spatial: RootState['spatial']): boolean =>
  openRun !== null &&
  openRun.key === key &&
  openRun.spatial === spatial &&
  timestamp - openRun.at >= 0 &&
  timestamp - openRun.at < MERGE_WINDOW_MS;

/** Forgets the open run, so the next commit starts a fresh undo step. */
export function resetCommitRun(): void {
  openRun = null;
}

/**
 * The single gateway for all spatial data mutations.
 * Returns an object allowing undo, plus metadata for toasts.
 *
 * @param patch One patch, or an ordered batch applied as a single undo step.
 * @param label The Vietnamese label describing the action (e.g. "Xoá tường").
 */
export function commit(
  patch: SpatialPatch | readonly SpatialPatch[],
  label: string
): CommitResult {
  const store = useStore.getState();
  const timestamp = Date.now();
  const patches = Array.isArray(patch) ? (patch as readonly SpatialPatch[]) : [patch as SpatialPatch];
  const key = runKey(patches);

  const temporal = useStore.temporal.getState();
  const folds = continuesRun(key, timestamp, store.spatial) && temporal.isTracking;

  // Apply the patch batch to the spatial slice
  if (folds) {
    temporal.pause();
  }

  try {
    store._applyPatches(patches);
  } finally {
    if (folds) {
      useStore.temporal.getState().resume();
    }
  }

  openRun = { key, at: timestamp, spatial: useStore.getState().spatial };

  // Thả tay là lúc lượt ghi thật thay chỗ bản xem trước, nên bản nháp bị dọn ở
  // ĐÂY chứ không ở người gọi: một panel quên gọi `discardPreview` sẽ để lại một
  // bức tường ma vẽ đè lên chính bức tường vừa sửa, và không ai nhìn thấy lỗi ấy
  // trong lúc đọc mã panel. Dọn sau khi vá đã áp: giữa hai lượt `set` này không
  // có lượt vẽ nào, nên không có khung hình nào thấy "mất preview mà chưa có
  // hình mới". Xem `previewEdit` ở cuối file.
  discardPreview();

  // zundo provides temporal api on useStore
  const undo = (): void => {
    useStore.temporal.getState().undo();
  };

  // Update history slice for UI to react. The undo goes with the label: the
  // toast that offers it must not have to guess which stack the write landed on
  // (see `historySlice.lastCommitUndo`).
  store.setLastCommit(label, timestamp, undo);

  // Return the interface as requested
  return {
    undo,
    label,
    timestamp,
  };
}

/* -------------------------------------------------------------------------- */
/* Lùi lại một lượt dispatch hỏng: ghi thật, nhưng KHÔNG mở bước hoàn tác.     */
/* -------------------------------------------------------------------------- */

/**
 * Puts the graph back after a failed dispatch, without opening an undo step.
 *
 * This is `SpatialPort.revertPatches` (`lib/commands/dispatch`) for the zustand
 * store, and it is not a second door past A10: the patches it applies are the
 * ones the command layer computed to cancel its own write, and nothing outside
 * the pipeline's rollback has a reason to call it.
 *
 * A rollback is not something the user did, so it must not be something they can
 * undo. Going through {@link commit} for it left two zundo past-states for one
 * failed dispatch — the run-folding does not merge them, because a create or a
 * delete rolls back under a different patch key than it applied under — and the
 * user's next Ctrl+Z re-applied the very change that had just been cancelled.
 *
 * zundo's own `pause`/`resume` does the suppressing, the same mechanism `commit`
 * uses to fold a drag: the write still happens, it just opens no new past state,
 * so the step Ctrl+Z returns to stays the one before the failed dispatch.
 */
export function applyRollbackPatches(patches: readonly SpatialPatch[]): void {
  const temporal = useStore.temporal.getState();
  const tracking = temporal.isTracking;

  if (tracking) {
    temporal.pause();
  }

  try {
    useStore.getState()._applyPatches(patches);
  } finally {
    if (tracking) {
      useStore.temporal.getState().resume();
    }
  }

  // The failed dispatch is over; whatever run was open died with it, so the next
  // commit must not fold into it.
  resetCommitRun();
  discardPreview();
}

/* -------------------------------------------------------------------------- */
/* Xem trước: lượt ghi TẠM, cùng cửa ra vào với lượt ghi thật.                 */
/* -------------------------------------------------------------------------- */

/**
 * Đề nghị một thay đổi TẠM THỜI, để mọi người xem đọc được nó mà mô hình đã lưu
 * không bị đụng tới.
 *
 * Đây là đường hợp lệ DUY NHẤT cho tầng màn hình: `local/no-draft-write-outside-commands`
 * khoá `stageDraftOperation`/`amendDraftOperation`/`discardDraft` ngoài `src/store`,
 * và luật ấy đúng — một panel gọi thẳng vào slice thì không ai còn bảo đảm được
 * bản nháp bị dọn. Nên bản nháp có một người sản xuất, ở đúng chỗ `commit` đứng:
 * cùng một cửa, một cửa cho lượt ghi thật và một cửa cho lượt ghi tạm, và cửa
 * tạm biết tự đóng khi cửa thật mở.
 *
 * Ba lời hứa của một bản nháp, và cả ba đều có chỗ giữ:
 *
 * - **Không bao giờ vào lịch sử hoàn tác.** `temporal` chỉ theo dõi `spatial`
 *   (`store/index.ts`, `partialize`), và bản nháp không nằm trong `spatial`.
 * - **Không bao giờ được tự lưu ra máy chủ.** `useAutosave` cũng chỉ đọc
 *   `state.spatial`; bản nháp không có đường nào tới đó.
 * - **Bị dọn khi người dùng thả tay.** Lúc ấy lệnh thật chạy qua {@link commit},
 *   và `commit` dọn bản nháp trước khi trả về — xem dưới.
 *
 * Một đối tượng có nhiều nhất MỘT thao tác nháp: kéo một thanh trượt phát hàng
 * chục lượt đề nghị trên cùng một bức tường, và cộng dồn chúng thành hàng chục
 * thao tác sẽ bắt người đọc phải tự tìm cái cuối. Lượt sau SỬA lại lượt trước
 * (`amendDraftOperation`) — đúng việc mà hàm ấy được viết ra để làm.
 *
 * @param entityId Đối tượng đã lưu mà bản xem trước đứng thay.
 * @param preview Cả đối tượng như nó sẽ trông, không phải một phần khác biệt.
 */
export function previewEdit(entityId: EntityId, preview: SpatialEntity): void {
  const store = useStore.getState();
  const operation: EditEntityDraft = { kind: 'editEntity', entityId, preview };
  const index = store.draftOperations.findIndex(
    (staged) => draftEntityId(staged) === entityId,
  );

  if (index === -1) {
    store.stageDraftOperation(operation);

    return;
  }

  store.amendDraftOperation(index, operation);
}

/**
 * Bỏ bản nháp đang treo. Không có nháp nào thì không ghi gì cả.
 *
 * Người dùng huỷ (Esc, bỏ ô nhập, lệnh bị từ chối) gọi hàm này. Người dùng thả
 * tay thì không cần gọi: {@link commit} tự dọn.
 */
export function discardPreview(): void {
  if (useStore.getState().draftOperations.length > 0) {
    useStore.getState().discardDraft();
  }
}
