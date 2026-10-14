/**
 * Đường lưu của màn Pascal: một lượt sửa trong editor thành một lệnh AppFront.
 *
 * Năm chặng, theo đúng thứ tự, và không chặng nào bỏ được:
 *
 * 1. `diffScenes(trước, sau)` — Pascal không khai node nào đã đổi, nó chỉ đưa
 *    cả cảnh. Phần chênh là thứ dựng ra `PascalCommit`.
 * 2. `createChangeGate().admit(...)` — chặn lượt ghi ma (đến trước lần nạp đầu,
 *    đến trong lúc nạp lại) và chặn xoá hàng loạt (`MASS_DELETE_RATIO`).
 * 3. `createPascalEditCommand(...)` — dựng `Command` với ảnh chụp đủ hai phía.
 * 4. `dispatch(...)` — năm bước của tầng lệnh: validate → apply → history →
 *    rules → sync. Bước `apply` gọi `commit(patches, nhãn)` (A10), và chính
 *    `commit` làm bản vẽ bẩn, nên tự lưu 800 ms của A7 chạy không cần ai gọi.
 * 5. Lượt nào bị từ chối thì màn nói ra bằng tiếng Việt và giữ nguyên cảnh đã
 *    lưu làm mốc — editor tự lùi thao tác, xem `use-auto-save.ts` của vendor.
 *
 * ## Hoàn tác (A8) — vì sao không nối Ctrl+Z của editor vào ngăn lệnh
 *
 * Zundo của Pascal hoàn tác bằng cách ghi lại store cảnh. Lượt ghi ấy đi qua
 * đúng cái đăng ký mà mọi lượt sửa khác đi qua, nên nó tới đây như một lượt
 * sửa bình thường và sinh ra một `Command` ngược — không thêm dòng mã nào.
 * Nối chéo Ctrl+Z sang `HistoryStack` của AppFront thì phải đồng bộ hai ngăn
 * xếp, và hai ngăn xếp lệch nhau là lỗi không ai dựng lại được.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { PascalCommitVerdict } from '@/components/pascal/pascalMountTypes';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import {
  createIncrementalRuleRunner,
  dispatch,
  type DispatchDeps,
  type SpatialPort,
} from '@/lib/commands/dispatch';
import { createHistoryStack, NO_SELECTION } from '@/lib/commands/history';
import { diffScenes, isEmptyDiff } from '@/lib/pascal/diff';
import { createPascalEditCommand, type PascalEditResult } from '@/lib/pascal/fromPascal';
import { createChangeGate, type PascalCommit } from '@/lib/pascal/guard';
import type { PascalIdBook } from '@/lib/pascal/toSpatial';
import type { PascalScene } from '@/lib/pascal/types';
import { useStore } from '@/store';
import { applyRollbackPatches, commit } from '@/store/commit';

/**
 * Ai đang sửa, khi màn chưa có danh tính thật.
 *
 * `validateCommands` từ chối một lệnh thiếu `actorId`, nên hằng này là cái giữ
 * cho đường ghi chạy được trước khi phiên mang id người dùng tới — cùng khuôn
 * `AXIS_GRID_DEFAULT_ACTOR_ID` của màn trục.
 */
export const PASCAL_DEFAULT_ACTOR_ID = 'pascal-editor';

/** Câu dự phòng khi một lượt sửa bị chặn mà không ai nêu được lý do. */
export const PASCAL_REJECTED_FALLBACK = 'Không ghi được thay đổi này.';

/** Lý do từ chối khi vai chỉ được xem. */
export const PASCAL_READ_ONLY_REASON = 'Vai của bạn chỉ được xem, không sửa được mô hình.';

export interface UsePascalEditsOptions {
  /** Bản vẽ đã chuẩn hoá đang sửa; `null` nghĩa là chưa có gì để ghi lên. */
  readonly spatial: NormalizedSpatial | null;
  /** Cảnh đã đẩy sang Pascal — mốc "trước" của phần chênh đầu tiên. */
  readonly loadedScene: PascalScene | null;
  /** Vai chỉ-xem thì không lượt ghi nào được dựng, kể cả khi editor gửi tới. */
  readonly readOnly: boolean;
  /** Nói ra lý do một lượt sửa bị chặn. Màn hình quyết định hiện bằng cách nào. */
  readonly onRejected: (reason: string) => void;
  /**
   * Cổng chặn một lượt xoá hàng loạt (`PASCAL_MASS_DELETE`): màn mở hộp xác nhận
   * (A9, `guard.ts`). Editor đã lùi lượt xoá; xác nhận thì gọi
   * `confirmMassDelete(nodeIds)` rồi cho editor xoá lại đúng các node ấy.
   */
  readonly onMassDelete?: (request: PascalMassDeleteRequest) => void;
  readonly actorId?: string;
}

/** Một lượt xoá hàng loạt chờ người dùng xác nhận. */
export interface PascalMassDeleteRequest {
  /** Mã node Pascal bị xoá, kể cả con cháu. */
  readonly nodeIds: readonly string[];
  /** Câu tiếng Việt của cổng: "Thay đổi này xoá … nên phải được xác nhận trước." */
  readonly reason: string;
}

export interface UsePascalEditsResult {
  /** Truyền cho khung nhúng: cảnh sau một lượt sửa. `true` khi lượt ấy đã vào kho. */
  readonly onSceneCommit: (scene: PascalScene) => Promise<boolean>;
  /** Truyền cho khung nhúng: phán quyết 6A, chạy trước khi lượt sửa vào lịch sử. */
  readonly validateCommit: (scene: PascalScene) => PascalCommitVerdict;
  /** Người dùng đã xác nhận xoá đúng các node này: lượt xoá kế tiếp của chúng được qua cổng. */
  readonly confirmMassDelete: (nodeIds: readonly string[]) => void;
}

/** Phần chênh thành lời khai của Pascal về những node đã đụng tới. */
export const commitOfScenes = (
  previous: PascalScene,
  next: PascalScene,
): PascalCommit | null => {
  const diff = diffScenes(previous, next);

  if (isEmptyDiff(diff)) return null;

  return {
    origin: 'local',
    changedNodeIds: [...diff.upsert.map((node) => node.id), ...diff.remove],
    removedNodeIds: diff.remove,
  };
};

export function usePascalEdits({
  spatial,
  loadedScene,
  readOnly,
  onRejected,
  onMassDelete,
  actorId = PASCAL_DEFAULT_ACTOR_ID,
}: UsePascalEditsOptions): UsePascalEditsResult {
  /** Cảnh máy chủ đang giữ. Mốc "trước" của lượt sửa kế tiếp. */
  const savedScene = useRef<PascalScene | null>(null);

  /* Cảnh từ nguồn ngoài vừa nạp vào editor thay mốc: lượt sửa sau so với nó,
     không so với lượt lưu cũ — thiếu dòng này thì thay đổi ngoài bị ghi lại
     như một lượt sửa của Pascal. */
  useEffect(() => {
    savedScene.current = null;
  }, [loadedScene]);
  /** Sổ id của phiên: đối tượng Pascal vừa vẽ giữ nguyên id qua nhiều lượt sửa. */
  const idBook = useRef<PascalIdBook>(new Map());
  const gate = useMemo(() => createChangeGate(), []);
  /**
   * Phán quyết gần nhất, kèm cảnh nó đã xét.
   *
   * `validateCommit` và `onSceneCommit` nhận **cùng một cảnh** cho cùng một
   * lượt sửa, nên dựng lệnh hai lần là dựng thừa — và `toSpatialGraph` chạy
   * trên cả cây, không phải phép tính rẻ.
   */
  const lastVerdict = useRef<{
    scene: PascalScene;
    result: PascalEditResult | null;
    /** Lượt này là xoá hàng loạt bị cổng chặn — các node bị xoá. */
    massDelete: readonly string[] | null;
  } | null>(null);
  /** Node người dùng đã xác nhận xoá; sống tới khi lượt xoá ấy vào kho. */
  const confirmedRemoval = useRef<ReadonlySet<string> | null>(null);

  const label = useRef('');
  const history = useMemo(() => createHistoryStack(), []);

  const deps = useMemo<DispatchDeps>(() => {
    const spatialPort: SpatialPort = {
      read: () => useStore.getState().spatial,
      applyPatches: (patches) => {
        commit(patches, label.current);
      },
      revertPatches: applyRollbackPatches,
    };

    return {
      spatial: spatialPort,
      history: {
        push: (entry) => {
          history.push({ entry, selectionBefore: NO_SELECTION, selectionAfter: NO_SELECTION });
        },
        drop: (entryId) => {
          history.drop(entryId);
        },
      },
      rules: createIncrementalRuleRunner(),
      /* Bước `sync` không xếp hàng gì: `commit` đã làm bản vẽ bẩn và bộ tự lưu
         tầng mà container gắn (`useFloorLayerAutosave`) nhặt nó lên sau 800 ms. Một lượt gửi thứ
         hai ở đây là gửi hai lần cùng một thay đổi. */
      sync: { enqueue: () => undefined },
    };
  }, [history]);

  /** Lệnh cho một cảnh, lời từ chối, hoặc `null` khi không có gì để ghi. */
  const buildFor = useCallback(
    (scene: PascalScene): PascalEditResult | null => {
      if (lastVerdict.current?.scene === scene) return lastVerdict.current.result;

      const previous = savedScene.current ?? loadedScene;

      if (spatial === null || previous === null) return null;

      const pascalCommit = commitOfScenes(previous, scene);

      if (pascalCommit === null) return null;

      // Cảnh đầu đã nằm trong Pascal rồi mới có lượt sửa này, nên cổng ở
      // trạng thái "đã nạp" — không có đường nào khác để nó biết điều đó.
      if (!gate.hasLoaded()) gate.acknowledgeLoad();

      const removed = pascalCommit.removedNodeIds ?? [];
      const confirmed = confirmedRemoval.current;
      const gateVerdict = gate.admit(pascalCommit, previous);
      const massDelete = !gateVerdict.admitted && gateVerdict.code === 'PASCAL_MASS_DELETE';
      const verdict =
        massDelete && confirmed !== null && removed.every((nodeId) => confirmed.has(nodeId))
          ? ({ admitted: true } as const)
          : gateVerdict;

      const result: PascalEditResult = verdict.admitted
        ? createPascalEditCommand({
            graph: spatial,
            scene,
            commit: pascalCommit,
            actorId,
            idBook: idBook.current,
          })
        : { ok: false, error: { type: 'pascal.edit', code: 'PASCAL_UNKNOWN_NODE', reasons: [verdict.reason] } };

      lastVerdict.current = { scene, result, massDelete: massDelete && !verdict.admitted ? removed : null };

      return result;
    },
    [actorId, gate, loadedScene, spatial],
  );

  const validateCommit = useCallback(
    (scene: PascalScene): PascalCommitVerdict => {
      if (readOnly) return { ok: false, message: PASCAL_READ_ONLY_REASON };

      const built = buildFor(scene);

      /* Không có gì để ghi là chuyện bình thường — lượt nạp đầu gần như luôn
         rơi vào đây — nên nó KHÔNG phải một lời từ chối với người dùng. */
      if (built === null || built.ok || built.error.code === 'PASCAL_NO_CHANGE') {
        return { ok: true };
      }

      const message = built.error.reasons[0] ?? PASCAL_REJECTED_FALLBACK;
      const massDelete = lastVerdict.current?.massDelete ?? null;

      // 23-A-026 — A9: lượt xoá lớn hỏi trước (GD:27-30), không chỉ toast.
      if (massDelete !== null) onMassDelete?.({ nodeIds: massDelete, reason: message });

      return { ok: false, message };
    },
    [buildFor, onMassDelete, readOnly],
  );

  const confirmMassDelete = useCallback((nodeIds: readonly string[]) => {
    confirmedRemoval.current = new Set(nodeIds);
  }, []);

  const onSceneCommit = useCallback(
    async (scene: PascalScene): Promise<boolean> => {
      if (readOnly) return false;

      const built = buildFor(scene);

      if (built === null) return false;

      if (!built.ok) {
        if (built.error.code !== 'PASCAL_NO_CHANGE') {
          onRejected(built.error.reasons[0] ?? PASCAL_REJECTED_FALLBACK);
        }

        return false;
      }

      label.current = built.data.description;

      const result = await dispatch(built.data, deps);

      if (!result.ok) {
        onRejected(result.error.reasons[0] ?? PASCAL_REJECTED_FALLBACK);

        return false;
      }

      savedScene.current = scene;
      confirmedRemoval.current = null;

      return true;
    },
    [buildFor, deps, onRejected, readOnly],
  );

  return { onSceneCommit, validateCommit, confirmMassDelete };
}
