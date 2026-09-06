/**
 * Ruột của `WallGeometryEditor` — hook trả về ĐÚNG props của view.
 *
 * `UseWallGeometryEditorResult = Omit<WallGeometryEditorProps, 'overlayRef'>`
 * (`wallGeometryEditorTypes.ts`, của T5), nên nếu hàm này lệch một trường thì
 * `tsc` kêu ngay tại đây — đó là toàn bộ lý do mối nối ấy tồn tại.
 *
 * ## Chế độ sửa là trạng thái CỤC BỘ của màn, không đi qua `toolMachine`
 *
 * `ToolId` là union đóng đúng tám giá trị và `ToolRegistry` là một `Record` đầy
 * đủ của tám giá trị ấy (`lib/tools/toolMachine.ts:84-104,340`), nên không có
 * cách nào đăng ký công cụ sửa đỉnh mà không sửa `src/lib` — việc bị cấm. Sáu
 * công cụ của thanh nổi vì thế sống trong `useState` của chính hook: đây là
 * MODE STATE, không phải một phép hình học, nên R-61 không bị chạm tới. Mọi
 * phép hình học vẫn nằm sau cổng.
 *
 * ## Một phiên kéo sinh ĐÚNG MỘT bước hoàn tác (D-06)
 *
 * Cấu trúc giữ lời hứa ấy, không phải kỷ luật: `onPointerMove` chỉ có đường tới
 * `gateway.previewVertexMove` (bản nháp — không vào lịch sử, không tự lưu, và
 * nhiều lượt gọi chỉ dồn thành MỘT thao tác nháp, `store/commit.ts:179`), còn
 * đường tới một hàm dựng lệnh chỉ mở ra ở `onPointerUp`. Bốn mươi khung hình
 * kéo vì thế gọi `commitVertexMove` đúng một lần, và `commit` tự dọn bản nháp
 * trước khi trả về (`commit.ts:131`).
 *
 * `createDragSession` (`lib/three/interaction/dragSession.ts`) giữ đúng lời hứa
 * ấy cho gizmo 3D, nhưng nó nhận `PickRay` — một tia từ camera — và trả một
 * `GizmoDelta` MỘT TRỤC. Lớp phủ này nhận điểm con trỏ hai chiều và một đỉnh
 * chạy tự do trên mặt bằng; dựng một tia giả để lách vào chữ ký ấy là bịa ra
 * phép chiếu camera mà màn không có (và `Viewer3D` thì bị cấm sửa). Nên màn đi
 * đúng ba cửa mà hợp đồng T4 mở sẵn cho nó — `previewVertexMove` /
 * `discardVertexPreview` / `commitVertexMove` — và giữ nguyên cấu trúc "chỉ lúc
 * thả tay mới có lệnh" của `dragSession`.
 *
 * ## Esc phân lớp (A12)
 *
 * Đang kéo ⇒ huỷ phiên kéo, `discardVertexPreview()`, đỉnh về đúng toạ độ ban
 * đầu (bản nháp bị bỏ nên hình đã lưu chưa từng đổi), tay nắm trả về chỗ cũ
 * trong `WALL_GEOMETRY_MOTION.cancelDrag`. Đang gõ một ô toạ độ ⇒ bỏ bản nháp
 * của ô. Không có lớp nào bên trên ⇒ thoát chế độ sửa.
 *
 * ## R-64 — cờ tải và cờ hỏng không phải `useState`
 *
 * Chúng tới từ `useQuery` trên `gateway.readWallGeometry`, dưới một khoá nằm
 * TRONG nhánh `queryKeys.space.byFloor` nên `invalidationMap.editWall` dọn nó
 * theo tiền tố sau mỗi lượt ghi. `useState` ở đây chỉ giữ trạng thái của riêng
 * giao diện: công cụ đang cầm, ô đang gõ, phiên kéo, phím bổ trợ đang giữ.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useShortcut } from '@/hooks/useShortcut';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys, type QueryKey } from '@/lib/query/queryKeys';
import {
  applyShortcut,
  clearModifiers,
  NO_MODIFIERS,
  resolveKeyDown,
  resolveKeyUp,
  type ModifierState,
} from '@/lib/tools/shortcuts';
import { durationMs } from '@/lib/motion/tokens';
import { useStore } from '@/store';
import { selectDraftPreviewGraph } from '@/store/selectors';

import {
  createWallGeometryEditorGateway,
  createWallGeometryProjection,
  edgeIdOf,
  EMPTY_WALL_GEOMETRY_REVIEW,
  formatCoordinate,
  formatLengthLabel,
  lockToAxis,
  measureWall,
  nudgeTargetOf,
  parseCoordinate,
  readWallTarget,
  reviewWallGeometry,
  vertexDisplayCode,
  vertexIdOf,
  wallDisplayCode,
  WALL_GEOMETRY_SNAP_KIND_IDS,
  WALL_GEOMETRY_SNAP_LABELS,
  type WallGeometryEditorGateway,
  type WallGeometryEditorGatewayInjection,
  type WallGeometryEditorResult,
  type WallGeometryPointMm,
  type WallGeometryProjection,
  type WallGeometryRefusal,
  type WallGeometrySnapCandidate,
} from './wallGeometryEditorGateway';
import {
  WALL_GEOMETRY_EDITOR_LAYOUT,
  WALL_GEOMETRY_EDITOR_TEXT,
  WALL_GEOMETRY_MOTION,
  WALL_GEOMETRY_TOOL_IDS,
  type SnapKindId,
  type UseWallGeometryEditorOptions,
  type UseWallGeometryEditorResult,
  type WallGeometryDimensionSegment,
  type WallGeometryEdgeHighlight,
  type WallGeometryEditorContent,
  type WallGeometryEditorState,
  type WallGeometryHandle,
  type WallGeometryNudgeDirection,
  type WallGeometryPointPx,
  type WallGeometrySnapGuide,
  type WallGeometrySnapKind,
  type WallGeometryToolButton,
  type WallGeometryToolId,
  type WallGeometryVertexCell,
  type WallGeometryVertexRow,
} from './wallGeometryEditorTypes';

const TEXT = WALL_GEOMETRY_EDITOR_TEXT;
const LAYOUT = WALL_GEOMETRY_EDITOR_LAYOUT;

/** Tuỳ chọn thật của hook: hợp đồng của T5 cộng chỗ tiêm cổng của T6. */
export type UseWallGeometryEditorInput = UseWallGeometryEditorOptions &
  WallGeometryEditorGatewayInjection;

/* -------------------------------------------------------------------------- */
/* Khoá đọc — nằm trong nhánh `space.byFloor` để lượt ghi dọn nó theo tiền tố.  */
/* -------------------------------------------------------------------------- */

/** Đuôi khoá của lượt đọc hình học một bức tường. */
const WALL_GEOMETRY_QUERY_SEGMENT = 'wallGeometry';

/**
 * Khoá của lượt đọc.
 *
 * Nối thêm hai đoạn vào `queryKeys.space.byFloor(floorId)` chứ không dựng một
 * nhánh mới: `invalidationMap.editWall` dọn đúng khoá tầng ấy, và
 * `invalidateQueries` khớp theo TIỀN TỐ, nên khoá con này được dọn cùng lúc mà
 * không phải thêm một mục nào vào bảng dọn dẹp (`lib/query/invalidation.ts:70`).
 */
const wallGeometryQueryKey = (floorId: string, wallId: string): QueryKey => [
  ...queryKeys.space.byFloor(floorId),
  WALL_GEOMETRY_QUERY_SEGMENT,
  wallId,
];

/* -------------------------------------------------------------------------- */
/* Những mảnh nhỏ của hook.                                                    */
/* -------------------------------------------------------------------------- */

/** Tầng chưa hiệu chỉnh thì một pixel là một milimét — cùng mặc định màn S-12 dùng. */
const UNCALIBRATED_MILLIMETRES_PER_PIXEL = 1;

/** Phiên kéo đang chạy, phần hook giữ cho riêng mình. */
interface DragRun {
  readonly handleId: string;
  readonly vertexId: string;
  /** Chỗ đỉnh đứng lúc bắt tay kéo — Esc trả nó về đúng đây. */
  readonly originMm: WallGeometryPointMm;
}

/** Kích thước lớp phủ, đo từ chính phần tử DOM sau lượt gắn đầu. */
interface OverlaySize {
  readonly widthPx: number;
  readonly heightPx: number;
}

const NO_OVERLAY_SIZE: OverlaySize = { widthPx: 0, heightPx: 0 };

/** Cổng thật, dựng đúng một lần, trừ khi nơi gọi tiêm sẵn một cái (R-73). */
function useResolvedGateway(
  injected: WallGeometryEditorGateway | undefined,
): WallGeometryEditorGateway {
  const fallbackRef = useRef<WallGeometryEditorGateway | null>(null);

  if (injected !== undefined) {
    return injected;
  }

  fallbackRef.current ??= createWallGeometryEditorGateway();

  return fallbackRef.current;
}

/** Giá trị mới nhất của một prop, để hàm xử lý không phải dựng lại mỗi lượt vẽ. */
function useLatest<TValue>(value: TValue): { current: TValue } {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  });

  return ref;
}

/** Bề rộng và bề cao của lớp phủ, theo dõi được cả khi cửa sổ đổi cỡ. */
function useOverlaySize(element: HTMLElement | null): OverlaySize {
  const [size, setSize] = useState<OverlaySize>(NO_OVERLAY_SIZE);

  useEffect(() => {
    if (element === null) {
      setSize(NO_OVERLAY_SIZE);

      return undefined;
    }

    const measure = (): void => {
      const rect = element.getBoundingClientRect();

      setSize({ heightPx: rect.height, widthPx: rect.width });
    };

    measure();

    /* jsdom không có `ResizeObserver`; một lượt đo lúc gắn là đủ cho bài kiểm. */
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measure);

    observer.observe(element);

    return (): void => {
      observer.disconnect();
    };
  }, [element]);

  return size;
}

/**
 * Phím bổ trợ đang giữ: Shift khoá trục, Alt tắt bắt điểm.
 *
 * `lib/tools/shortcuts.ts` đã khai sẵn cả bảng và cả bộ chuyển trạng thái
 * (`resolveKeyDown` / `resolveKeyUp` / `applyShortcut`), và chú thích đầu file
 * ấy nói rõ nó "không bao giờ chạm `window`" — việc gắn một cặp nghe phím là
 * của nơi gọi. Đăng ký phím tắt của `shortcutRegistry` không thay được: nó cố ý
 * BỎ QUA một lượt nhấn chỉ có phím bổ trợ (`shortcutRegistry.ts:294`) và không
 * có sự kiện nhả phím, nên nó không biết một phím đang được GIỮ.
 *
 * Mất focus thì nhả hết: lượt nhả phím xảy ra ngoài trang không bao giờ tới, và
 * một phím kẹt còn tệ hơn một phím nhả sớm.
 */
function useHeldModifiers(isActive: boolean): ModifierState {
  const [modifiers, setModifiers] = useState<ModifierState>(NO_MODIFIERS);

  useEffect(() => {
    if (!isActive) {
      setModifiers(clearModifiers());

      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const action = resolveKeyDown(event, event.target as HTMLElement | null);

      if (action !== null) {
        setModifiers((current) => applyShortcut(current, action));
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      const action = resolveKeyUp(event);

      if (action !== null) {
        setModifiers((current) => applyShortcut(current, action));
      }
    };

    const onBlur = (): void => {
      setModifiers(clearModifiers());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return (): void => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isActive]);

  return modifiers;
}

/** Câu nói ra hai phím bổ trợ cho trình đọc màn hình; `null` khi không giữ phím nào. */
function modifierNoticeOf(modifiers: ModifierState): string | null {
  const parts: string[] = [];

  if (modifiers.lockAxis) {
    parts.push(TEXT.snap.axisLocked);
  }

  if (modifiers.suspendSnap) {
    parts.push(TEXT.snap.suppressed);
  }

  return parts.length === 0 ? null : parts.join(' ');
}

/** Câu giải thích của một lượt đọc hỏng. */
function readErrorExplanation(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';

  /* Không có câu nào của tầng dưới thì nói đúng thứ đang thiếu: chỗ để đọc và để lưu. */
  return message === '' ? TEXT.refusal.noSaveTarget : message;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

export function useWallGeometryEditor(
  options: UseWallGeometryEditorInput,
): UseWallGeometryEditorResult {
  const gateway = useResolvedGateway(options.gateway);
  const queryClient = useQueryClient();

  const { canEdit, isCollapsed, isSectionOrthographic, overlayElement, selectedWallIds, wallId } =
    options;
  const onExitEditMode = useLatest(options.onExitEditMode);
  const onGeometryChanged = useLatest(options.onGeometryChanged);

  /* ---------------------------------------------------------------------- */
  /* Kho: đồ thị đang sửa, bản nháp của phiên kéo, khung nhìn, nơi để lưu.    */
  /* ---------------------------------------------------------------------- */

  const spatial = useStore((state) => state.spatial);
  const draftGraph = useStore(selectDraftPreviewGraph);
  const zoom = useStore((state) => state.zoom);
  const viewCentre = useStore((state) => state.viewCenter);
  const projectId = useStore((state) => state.project?.id ?? null);
  const floorId = useStore((state) => state.activeFloorId);

  /** Hình đang HIỆN: bản nháp của phiên kéo nếu có, còn lại là hình đã lưu. */
  const graph = draftGraph ?? spatial;

  const target = useMemo(
    () => (wallId === null ? null : readWallTarget(graph, wallId)),
    [graph, wallId],
  );

  /**
   * M-04 → M-05 → M-09, chạy lại sau MỖI lệnh.
   *
   * Khoá theo `spatial` — hình ĐÃ LƯU — nên nó chạy đúng một lần cho mỗi lượt
   * ghi và không chạy lại 60 lần mỗi giây trong lúc kéo, còn bản nháp thì không
   * cần soát vì nó chưa phải bản vẽ của ai. Là một `useMemo` của chính đồ thị
   * nên không có đường nào để một lệnh chạy xong mà ba phép này bị bỏ qua.
   */
  const review = useMemo(
    () => (wallId === null ? EMPTY_WALL_GEOMETRY_REVIEW : reviewWallGeometry(spatial, wallId)),
    [spatial, wallId],
  );

  /* ---------------------------------------------------------------------- */
  /* Lượt đọc máy chủ — nguồn DUY NHẤT của cờ tải và cờ hỏng (R-64).          */
  /* ---------------------------------------------------------------------- */

  const geometryQuery = useQuery({
    enabled: wallId !== null && floorId !== null,
    queryFn: () => gateway.readWallGeometry(wallId ?? ''),
    queryKey: wallGeometryQueryKey(floorId ?? '', wallId ?? ''),
  });

  const invalidate = useCallback(() => {
    if (projectId === null || floorId === null) {
      return;
    }

    applyInvalidation(queryClient, 'editWall', { floorId, projectId });
  }, [floorId, projectId, queryClient]);

  /* ---------------------------------------------------------------------- */
  /* Trạng thái của riêng giao diện.                                         */
  /* ---------------------------------------------------------------------- */

  const [activeToolId, setActiveToolId] = useState<WallGeometryToolId>('moveVertex');
  const [hoveredHandleId, setHoveredHandleId] = useState<string | null>(null);
  const [selectedVertexId, setSelectedVertexId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({});
  const [invalidCells, setInvalidCells] = useState<readonly string[]>([]);
  const [drag, setDrag] = useState<DragRun | null>(null);
  const [returningHandleId, setReturningHandleId] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<WallGeometryRefusal | null>(null);
  const [guides, setGuides] = useState<readonly WallGeometrySnapCandidate[]>([]);
  const [disabledSnapKinds, setDisabledSnapKinds] = useState<readonly SnapKindId[]>([]);

  const isEditable = canEdit && !isSectionOrthographic && !isCollapsed;
  const modifiers = useHeldModifiers(isEditable && wallId !== null);

  const overlaySize = useOverlaySize(overlayElement);

  const projection: WallGeometryProjection = useMemo(
    () =>
      createWallGeometryProjection({
        centreMm: { xMm: viewCentre.x, yMm: viewCentre.y },
        heightPx: overlaySize.heightPx,
        millimetresPerPixel:
          target?.level.scaleMillimetresPerPixel ?? UNCALIBRATED_MILLIMETRES_PER_PIXEL,
        widthPx: overlaySize.widthPx,
        zoom,
      }),
    [overlaySize.heightPx, overlaySize.widthPx, target, viewCentre.x, viewCentre.y, zoom],
  );

  /* Bản nháp treo lại sau khi màn đóng là một bản nháp không ai dọn. */
  useEffect(
    () => () => {
      gateway.discardVertexPreview();
    },
    [gateway],
  );

  /* ---------------------------------------------------------------------- */
  /* Lượt ghi — mọi đường đều đi qua cổng, và mỗi đường sinh MỘT bước.        */
  /* ---------------------------------------------------------------------- */

  const applyResult = useCallback(
    (result: WallGeometryEditorResult<unknown>): void => {
      if (!result.ok) {
        setRefusal(result.refusal);

        return;
      }

      setRefusal(null);
      invalidate();

      if (wallId !== null) {
        onGeometryChanged.current(wallId);
      }
    },
    [invalidate, onGeometryChanged, wallId],
  );

  const commitVertexMove = useCallback(
    (vertexId: string, toMm: WallGeometryPointMm): void => {
      if (wallId === null || !isEditable) {
        return;
      }

      void gateway.commitVertexMove({ toMm, vertexId, wallId }).then(applyResult);
    },
    [applyResult, gateway, isEditable, wallId],
  );

  /* ---------------------------------------------------------------------- */
  /* Phiên kéo — ba cửa, và chỉ cửa cuối mới sinh một lệnh.                   */
  /* ---------------------------------------------------------------------- */

  const enabledSnapKinds = useMemo(
    () => WALL_GEOMETRY_SNAP_KIND_IDS.filter((kindId) => !disabledSnapKinds.includes(kindId)),
    [disabledSnapKinds],
  );

  /**
   * Chỗ đỉnh sẽ tới, sau bắt điểm và sau khoá trục.
   *
   * Bắt điểm hỏi cổng (`snapToTargets` của domain đứng sau nó), khoá trục gọi
   * `lockDirection` của domain. Hook không tính một toạ độ nào bằng công thức
   * của chính nó; nó chỉ chọn thứ tự hai phép ấy — bắt trước, khoá sau, vì
   * Shift là lời nói cuối cùng của người dùng.
   */
  const resolveDragPoint = useCallback(
    (
      run: DragRun,
      atPx: WallGeometryPointPx,
    ): { readonly pointMm: WallGeometryPointMm; readonly found: readonly WallGeometrySnapCandidate[] } => {
      const rawMm = projection.toMm(atPx);

      if (wallId === null) {
        return { found: [], pointMm: rawMm };
      }

      const found = modifiers.suspendSnap
        ? []
        : gateway
            .findSnapCandidates({
              atMm: rawMm,
              millimetresPerPixel: projection.millimetresPerPixel,
              radiusPx: LAYOUT.snapRadiusPx,
              vertexId: run.vertexId,
              wallId,
            })
            .filter((candidate) => enabledSnapKinds.includes(candidate.kindId));

      const snapped = found[0]?.atMm ?? rawMm;

      return { found, pointMm: lockToAxis(run.originMm, snapped, modifiers.lockAxis) };
    },
    [enabledSnapKinds, gateway, modifiers.lockAxis, modifiers.suspendSnap, projection, wallId],
  );

  const onDragMove = useCallback(
    (atPx: WallGeometryPointPx): void => {
      if (drag === null || wallId === null) {
        return;
      }

      const resolved = resolveDragPoint(drag, atPx);

      setGuides(resolved.found);
      gateway.previewVertexMove({ toMm: resolved.pointMm, vertexId: drag.vertexId, wallId });
    },
    [drag, gateway, resolveDragPoint, wallId],
  );

  const onDragUp = useCallback(
    (atPx: WallGeometryPointPx): void => {
      if (drag === null) {
        return;
      }

      const resolved = resolveDragPoint(drag, atPx);

      setDrag(null);
      setGuides([]);
      commitVertexMove(drag.vertexId, resolved.pointMm);
    },
    [commitVertexMove, drag, resolveDragPoint],
  );

  const onDragCancel = useCallback((): void => {
    if (drag === null) {
      return;
    }

    gateway.discardVertexPreview();
    setDrag(null);
    setGuides([]);
    setReturningHandleId(drag.handleId);
  }, [drag, gateway]);

  /* Tay nắm về chỗ cũ xong thì cờ tắt — thời lượng lấy từ thang, không viết số (R-71). */
  useEffect(() => {
    if (returningHandleId === null) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setReturningHandleId(null);
    }, durationMs(WALL_GEOMETRY_MOTION.cancelDrag));

    return (): void => {
      window.clearTimeout(timer);
    };
  }, [returningHandleId]);

  /* ---------------------------------------------------------------------- */
  /* Ô toạ độ sửa được.                                                      */
  /* ---------------------------------------------------------------------- */

  const clearDrafts = useCallback((): boolean => {
    let cleared = false;

    setDrafts((current) => {
      cleared = Object.keys(current).length > 0;

      return cleared ? {} : current;
    });
    setInvalidCells([]);

    return cleared;
  }, []);

  const setDraft = useCallback((cellId: string, value: string): void => {
    setDrafts((current) => ({ ...current, [cellId]: value }));
  }, []);

  const clearDraft = useCallback((cellId: string): void => {
    setDrafts((current) => {
      if (current[cellId] === undefined) {
        return current;
      }

      const next: Record<string, string> = { ...current };

      delete next[cellId];

      return next;
    });
    setInvalidCells((current) => current.filter((id) => id !== cellId));
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Esc phân lớp (A12).                                                     */
  /* ---------------------------------------------------------------------- */

  const onEscape = useCallback((): void => {
    if (drag !== null) {
      onDragCancel();

      return;
    }

    if (clearDrafts()) {
      return;
    }

    onExitEditMode.current();
  }, [clearDrafts, drag, onDragCancel, onExitEditMode]);

  useShortcut({
    combo: 'Escape',
    description: 'thoát lớp trên cùng của chế độ sửa hình học',
    id: 'wallGeometryEditor.escape',
    onTrigger: onEscape,
    scope: 'canvas',
  });

  /* ---------------------------------------------------------------------- */
  /* Sáu công cụ — ba chế độ và ba thao tác chạy ngay.                        */
  /* ---------------------------------------------------------------------- */

  const wallCode = wallId === null ? '' : wallDisplayCode(wallId);

  const onRemoveVertex = useCallback((): void => {
    if (wallId === null || selectedVertexId === null || !isEditable) {
      return;
    }

    void gateway.removeVertex({ vertexId: selectedVertexId, wallId }).then(applyResult);
  }, [applyResult, gateway, isEditable, selectedVertexId, wallId]);

  const onJoinWalls = useCallback((): void => {
    const [firstId, secondId] = selectedWallIds;

    if (!isEditable || firstId === undefined || secondId === undefined) {
      setRefusal({ explanation: TEXT.refusal.joinNeedsTwoEnds, offendingEdgeIds: [] });

      return;
    }

    void gateway.joinWalls({ wallIds: [firstId, secondId] }).then(applyResult);
  }, [applyResult, gateway, isEditable, selectedWallIds]);

  /**
   * "Đặt lại chiều cao" đưa tường về chiều cao của TẦNG.
   *
   * Màn không có ô nhập chiều cao nào (`WallGeometryEditorProps` không mang một
   * trường nào cho nó), nên "đặt lại" chỉ có một nghĩa đọc được: trả về con số
   * mặc định mà tầng đã khai — `Level.heightMm` của `domain/spatial/types.ts`.
   * Không có ngưỡng nào được nghĩ ra ở đây.
   */
  const onResetHeight = useCallback((): void => {
    if (!isEditable || target === null) {
      return;
    }

    const wallIds = selectedWallIds.length > 0 ? selectedWallIds : [target.wall.id];

    void gateway.changeHeight({ heightMm: target.level.heightMm, wallIds }).then(applyResult);
  }, [applyResult, gateway, isEditable, selectedWallIds, target]);

  const onSelectTool = useCallback(
    (toolId: WallGeometryToolId): void => {
      setActiveToolId(toolId);

      if (toolId === 'removeVertex') {
        onRemoveVertex();
      }

      if (toolId === 'joinWalls') {
        onJoinWalls();
      }

      if (toolId === 'resetHeight') {
        onResetHeight();
      }
    },
    [onJoinWalls, onRemoveVertex, onResetHeight],
  );

  /* Sáu phím tắt của thanh công cụ — phạm vi `canvas`, đúng phím in trên gợi ý. */
  useShortcut({
    combo: TEXT.tools.moveVertex.key,
    description: TEXT.tools.moveVertex.label,
    id: 'wallGeometryEditor.tool.moveVertex',
    onTrigger: () => {
      onSelectTool('moveVertex');
    },
    scope: 'canvas',
  });
  useShortcut({
    combo: TEXT.tools.addVertex.key,
    description: TEXT.tools.addVertex.label,
    id: 'wallGeometryEditor.tool.addVertex',
    onTrigger: () => {
      onSelectTool('addVertex');
    },
    scope: 'canvas',
  });
  useShortcut({
    combo: TEXT.tools.removeVertex.key,
    description: TEXT.tools.removeVertex.label,
    id: 'wallGeometryEditor.tool.removeVertex',
    onTrigger: () => {
      onSelectTool('removeVertex');
    },
    scope: 'canvas',
  });
  useShortcut({
    combo: TEXT.tools.splitWall.key,
    description: TEXT.tools.splitWall.label,
    id: 'wallGeometryEditor.tool.splitWall',
    onTrigger: () => {
      onSelectTool('splitWall');
    },
    scope: 'canvas',
  });
  useShortcut({
    combo: TEXT.tools.joinWalls.key,
    description: TEXT.tools.joinWalls.label,
    id: 'wallGeometryEditor.tool.joinWalls',
    onTrigger: () => {
      onSelectTool('joinWalls');
    },
    scope: 'canvas',
  });
  useShortcut({
    combo: TEXT.tools.resetHeight.key,
    description: TEXT.tools.resetHeight.label,
    id: 'wallGeometryEditor.tool.resetHeight',
    onTrigger: () => {
      onSelectTool('resetHeight');
    },
    scope: 'canvas',
  });

  /* ---------------------------------------------------------------------- */
  /* Tay nắm.                                                                */
  /* ---------------------------------------------------------------------- */

  const vertices = useMemo(
    () =>
      target === null
        ? []
        : (['start', 'end'] as const).map((end, index) => ({
            atMm: {
              xMm: target.wall.centreline[end].x,
              yMm: target.wall.centreline[end].y,
            },
            code: vertexDisplayCode(index),
            id: vertexIdOf(target.wall.id, end),
          })),
    [target],
  );

  const onHandlePointerDown = useCallback(
    (vertexId: string, atPx: WallGeometryPointPx, originMm: WallGeometryPointMm): void => {
      if (!isEditable || activeToolId !== 'moveVertex') {
        return;
      }

      setSelectedVertexId(vertexId);
      setRefusal(null);
      setDrag({ handleId: vertexId, originMm, vertexId });
      void atPx;
    },
    [activeToolId, isEditable],
  );

  /**
   * Tay nắm cạnh: chỗ CẮT, không phải chỗ dời.
   *
   * "Thêm đỉnh" và "Tách tường" đều rơi vào cùng một lệnh `wall.split` của tầng
   * nghiệp vụ — một `Segment` chỉ có hai đầu mút, nên một đỉnh mới ở giữa chính
   * là một nhát cắt (xem docblock của cổng). Điểm cắt do domain rơi xuống tim
   * tường, màn không tự chiếu.
   */
  const onEdgePointerDown = useCallback(
    (atPx: WallGeometryPointPx): void => {
      if (wallId === null || !isEditable) {
        return;
      }

      const atMm = projection.toMm(atPx);

      if (activeToolId === 'addVertex') {
        void gateway.insertVertex({ atMm, edgeId: edgeIdOf(wallId), wallId }).then(applyResult);

        return;
      }

      if (activeToolId === 'splitWall') {
        void gateway.splitWall({ atMm, wallId }).then(applyResult);
      }
    },
    [activeToolId, applyResult, gateway, isEditable, projection, wallId],
  );

  const onNudgeVertex = useCallback(
    (
      vertexId: string,
      fromMm: WallGeometryPointMm,
      direction: WallGeometryNudgeDirection,
      isCoarse: boolean,
    ): void => {
      commitVertexMove(vertexId, nudgeTargetOf(fromMm, direction, isCoarse));
    },
    [commitVertexMove],
  );

  const handles = useMemo<readonly WallGeometryHandle[]>(() => {
    if (target === null) {
      return [];
    }

    const measure = measureWall(graph, target.wall.id);

    const vertexHandles = vertices.map<WallGeometryHandle>((vertex) => ({
      ariaLabel: TEXT.handles.vertex(vertex.code),
      atPx: projection.toPx(vertex.atMm),
      id: vertex.id,
      isDragging: drag?.vertexId === vertex.id,
      isEnabled: isEditable,
      isHovered: hoveredHandleId === vertex.id,
      kind: 'vertex',
      onNudge: (direction, isCoarse) => {
        onNudgeVertex(vertex.id, vertex.atMm, direction, isCoarse);
      },
      onPointerDown: (atPx) => {
        onHandlePointerDown(vertex.id, atPx, vertex.atMm);
      },
      onPointerEnter: () => {
        setHoveredHandleId(vertex.id);
      },
      onPointerLeave: () => {
        setHoveredHandleId(null);
      },
    }));

    if (measure === null) {
      return vertexHandles;
    }

    const edgeId = edgeIdOf(target.wall.id);
    const edgeHandle: WallGeometryHandle = {
      ariaLabel: TEXT.handles.edge(wallCode),
      atPx: projection.toPx(measure.midpointMm),
      id: edgeId,
      isDragging: false,
      isEnabled: isEditable && (activeToolId === 'addVertex' || activeToolId === 'splitWall'),
      isHovered: hoveredHandleId === edgeId,
      kind: 'edge',
      /* Cạnh là chỗ cắt, không phải chỗ dời: đường bàn phím của A12 nằm ở tay nắm ĐỈNH. */
      onNudge: () => undefined,
      onPointerDown: onEdgePointerDown,
      onPointerEnter: () => {
        setHoveredHandleId(edgeId);
      },
      onPointerLeave: () => {
        setHoveredHandleId(null);
      },
    };

    return [...vertexHandles, edgeHandle];
  }, [
    activeToolId,
    drag,
    graph,
    hoveredHandleId,
    isEditable,
    onEdgePointerDown,
    onHandlePointerDown,
    onNudgeVertex,
    projection,
    target,
    vertices,
    wallCode,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Bảng đỉnh.                                                              */
  /* ---------------------------------------------------------------------- */

  const commitCell = useCallback(
    (vertexId: string, axis: 'x' | 'y', atMm: WallGeometryPointMm, cellId: string): void => {
      const draft = drafts[cellId];

      if (draft === undefined) {
        return;
      }

      const value = parseCoordinate(draft);

      if (value === null) {
        setInvalidCells((current) => (current.includes(cellId) ? current : [...current, cellId]));

        return;
      }

      clearDraft(cellId);
      commitVertexMove(
        vertexId,
        axis === 'x' ? { xMm: value, yMm: atMm.yMm } : { xMm: atMm.xMm, yMm: value },
      );
    },
    [clearDraft, commitVertexMove, drafts],
  );

  const buildCell = useCallback(
    (
      vertexId: string,
      axis: 'x' | 'y',
      atMm: WallGeometryPointMm,
      isLocked: boolean,
    ): WallGeometryVertexCell => {
      const cellId = `${vertexId}:${axis}`;
      const draft = drafts[cellId];
      const displayValue = formatCoordinate(axis === 'x' ? atMm.xMm : atMm.yMm);
      const isInvalid = invalidCells.includes(cellId);

      return {
        displayValue,
        draftValue: draft ?? displayValue,
        message: isInvalid ? TEXT.vertexTable.cellInvalid : null,
        onCancel: () => {
          clearDraft(cellId);
        },
        onCommit: () => {
          commitCell(vertexId, axis, atMm, cellId);
        },
        onDraftChange: (nextValue) => {
          if (!isLocked) {
            setDraft(cellId, nextValue);
          }
        },
        status: isInvalid ? 'invalid' : draft === undefined ? 'idle' : 'editing',
      };
    },
    [clearDraft, commitCell, drafts, invalidCells, setDraft],
  );

  const vertexRows = useMemo<readonly WallGeometryVertexRow[]>(() => {
    const isLocked = !isEditable;

    return vertices.map((vertex) => ({
      code: vertex.code,
      id: vertex.id,
      isLocked,
      isSelected: selectedVertexId === vertex.id,
      onSelect: () => {
        setSelectedVertexId(vertex.id);
      },
      x: buildCell(vertex.id, 'x', vertex.atMm, isLocked),
      y: buildCell(vertex.id, 'y', vertex.atMm, isLocked),
    }));
  }, [buildCell, isEditable, selectedVertexId, vertices]);

  /* ---------------------------------------------------------------------- */
  /* Chuỗi kích thước — tường đang sửa cộng những tường dùng chung đầu mút.   */
  /* ---------------------------------------------------------------------- */

  const dimensionSegments = useMemo<readonly WallGeometryDimensionSegment[]>(() => {
    if (target === null) {
      return [];
    }

    const ids = [target.wall.id, ...review.dependentWallIds];
    const segments: WallGeometryDimensionSegment[] = [];

    for (const id of ids) {
      const measure = measureWall(graph, id);

      if (measure === null) {
        continue;
      }

      segments.push({
        id: measure.wallId,
        isLive: drag !== null,
        lengthLabel: formatLengthLabel(measure.lengthMm),
        midpointPx: projection.toPx(measure.midpointMm),
      });
    }

    return segments;
  }, [drag, graph, projection, review.dependentWallIds, target]);

  const totalLengthMm = useMemo(() => {
    if (target === null) {
      return null;
    }

    let total = 0;

    for (const id of [target.wall.id, ...review.dependentWallIds]) {
      total += measureWall(graph, id)?.lengthMm ?? 0;
    }

    return total;
  }, [graph, review.dependentWallIds, target]);

  /* ---------------------------------------------------------------------- */
  /* Bắt điểm và cạnh tô sáng.                                               */
  /* ---------------------------------------------------------------------- */

  const snapKinds = useMemo<readonly WallGeometrySnapKind[]>(
    () =>
      WALL_GEOMETRY_SNAP_KIND_IDS.map((kindId) => ({
        id: kindId,
        isEnabled: !disabledSnapKinds.includes(kindId),
        label: WALL_GEOMETRY_SNAP_LABELS[kindId] ?? kindId,
        onToggle: () => {
          setDisabledSnapKinds((current) =>
            current.includes(kindId)
              ? current.filter((id) => id !== kindId)
              : [...current, kindId],
          );
        },
      })),
    [disabledSnapKinds],
  );

  const activeGuides = useMemo<readonly WallGeometrySnapGuide[]>(
    () =>
      guides.map((candidate) => ({
        fromPx: projection.toPx(candidate.fromMm),
        id: candidate.kindId,
        kindId: candidate.kindId,
        label: candidate.label,
        labelAtPx: projection.toPx(candidate.atMm),
        toPx: projection.toPx(candidate.atMm),
      })),
    [guides, projection],
  );

  const edgeHighlights = useMemo<readonly WallGeometryEdgeHighlight[]>(
    () =>
      review.findings.map((finding) => ({
        ariaLabel:
          finding.severity === 'violation'
            ? TEXT.handles.offendingEdge(wallDisplayCode(finding.wallId))
            : finding.message,
        edgeId: edgeIdOf(finding.wallId),
        fromPx: projection.toPx(finding.fromMm),
        toPx: projection.toPx(finding.toMm),
        tone: finding.severity,
      })),
    [projection, review.findings],
  );

  /* ---------------------------------------------------------------------- */
  /* Thanh công cụ.                                                          */
  /* ---------------------------------------------------------------------- */

  const isHeightOnly = selectedWallIds.length > 1;

  const toolButtons = useMemo<readonly WallGeometryToolButton[]>(() => {
    if (!isEditable) {
      /* Vai chỉ xem và lát cắt trực giao GỠ nút khỏi thanh, không làm mờ chúng. */
      return [];
    }

    const supports = gateway.supports;
    const canUse: Readonly<Record<WallGeometryToolId, boolean>> = {
      addVertex: supports.insertVertex,
      joinWalls: supports.joinWalls && selectedWallIds.length === 2,
      moveVertex: supports.moveVertex,
      removeVertex: supports.removeVertex && selectedVertexId !== null,
      resetHeight: supports.changeHeight,
      splitWall: supports.splitWall,
    };

    return WALL_GEOMETRY_TOOL_IDS.filter(
      (toolId) => supportsTool(supports, toolId) && (!isHeightOnly || toolId === 'resetHeight'),
    ).map((toolId) => ({
      iconCode: toolId,
      id: toolId,
      isActive: activeToolId === toolId,
      isEnabled: canUse[toolId],
      keyLabel: TEXT.tools[toolId].key,
      label: TEXT.tools[toolId].label,
      onSelect: () => {
        onSelectTool(toolId);
      },
      tooltip: TEXT.tools.tooltip(TEXT.tools[toolId].label, TEXT.tools[toolId].key),
    }));
  }, [
    activeToolId,
    gateway.supports,
    isEditable,
    isHeightOnly,
    onSelectTool,
    selectedVertexId,
    selectedWallIds.length,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Ráp nội dung chung của bốn trạng thái có một bức tường mở ra.            */
  /* ---------------------------------------------------------------------- */

  const content = useMemo<WallGeometryEditorContent>(
    () => ({
      band: {
        doneLabel: TEXT.band.done,
        label: TEXT.band.editing(wallCode),
        onDone: () => {
          onExitEditMode.current();
        },
      },
      /**
       * Không có vết vẽ gốc nào để so, nên KHÔNG vẽ chip — vắng mặt là một câu
       * trả lời, không phải một chỗ trống phải lấp bằng dữ liệu bịa.
       */
      comparisonChip: null,
      dimensionChain: {
        segments: dimensionSegments,
        totalLabel: totalLengthMm === null ? null : formatLengthLabel(totalLengthMm),
      },
      drag:
        drag === null
          ? null
          : {
              handleId: drag.handleId,
              onCancel: onDragCancel,
              onPointerMove: onDragMove,
              onPointerUp: onDragUp,
            },
      edgeHighlights,
      handles,
      returningHandleId,
      snap: {
        activeGuides,
        isAxisLocked: modifiers.lockAxis,
        isSuppressed: modifiers.suspendSnap,
        kinds: snapKinds,
        modifierNotice: modifierNoticeOf(modifiers),
      },
      toolbar: {
        buttons: toolButtons,
        /* Câu gợi ý chỉ thuộc về trạng thái `empty`, và `empty` không mang nội dung này. */
        hint: null,
      },
      vertexTable: {
        columns: {
          code: TEXT.vertexTable.columnCode,
          x: TEXT.vertexTable.columnX,
          y: TEXT.vertexTable.columnY,
        },
        emptyMessage: vertexRows.length === 0 ? TEXT.vertexTable.empty : null,
        rows: vertexRows,
      },
    }),
    [
      activeGuides,
      dimensionSegments,
      drag,
      edgeHighlights,
      handles,
      modifiers,
      onDragCancel,
      onDragMove,
      onDragUp,
      onExitEditMode,
      returningHandleId,
      snapKinds,
      toolButtons,
      totalLengthMm,
      vertexRows,
      wallCode,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái.                                                         */
  /* ---------------------------------------------------------------------- */

  const gap = review.gap;

  const onCloseGap = useCallback((): void => {
    if (wallId === null || !isEditable) {
      return;
    }

    void gateway.closeGap({ wallId }).then(applyResult);
  }, [applyResult, gateway, isEditable, wallId]);

  const onDismissError = useCallback((): void => {
    setRefusal(null);
  }, []);

  const state = useMemo<WallGeometryEditorState>(() => {
    if (wallId === null) {
      return { hint: TEXT.states.empty.hint, kind: 'empty', message: TEXT.states.empty.message };
    }

    if (isCollapsed) {
      return {
        kind: 'collapsed',
        notice: TEXT.states.collapsed.notice,
        onExit: () => {
          onExitEditMode.current();
        },
        summaryLabel: TEXT.states.collapsed.summary(wallCode),
      };
    }

    if (geometryQuery.isLoading) {
      return { kind: 'loading', message: TEXT.states.loading.message };
    }

    if (!canEdit || isSectionOrthographic) {
      return {
        ...content,
        kind: 'forbidden',
        notice: isSectionOrthographic
          ? TEXT.states.forbidden.sectionOrthographic
          : TEXT.states.forbidden.viewerRole,
      };
    }

    if (refusal !== null) {
      return {
        ...content,
        explanation: refusal.explanation,
        kind: 'error',
        offendingEdgeIds: refusal.offendingEdgeIds,
        onDismissError,
      };
    }

    if (geometryQuery.isError) {
      return {
        ...content,
        explanation: readErrorExplanation(geometryQuery.error),
        kind: 'error',
        offendingEdgeIds: [],
        onDismissError,
      };
    }

    if (isHeightOnly || gap !== null) {
      return {
        ...content,
        gap:
          gap === null
            ? null
            : {
                closeLabel: TEXT.states.partial.closeGap,
                onCloseGap,
                sizeLabel: formatLengthLabel(gap.gapMm),
              },
        isHeightOnly,
        kind: 'partial',
        notice: isHeightOnly
          ? TEXT.states.partial.heightOnly
          : (review.danglingNotices[0] ?? TEXT.states.partial.heightOnly),
      };
    }

    return { ...content, kind: 'success' };
  }, [
    canEdit,
    content,
    gap,
    geometryQuery.error,
    geometryQuery.isError,
    geometryQuery.isLoading,
    isCollapsed,
    isHeightOnly,
    isSectionOrthographic,
    onCloseGap,
    onDismissError,
    onExitEditMode,
    refusal,
    review.danglingNotices,
    wallCode,
    wallId,
  ]);

  return { state };
}

/** Khả năng nào của cổng đứng sau một nút của thanh công cụ. */
function supportsTool(
  supports: WallGeometryEditorGateway['supports'],
  toolId: WallGeometryToolId,
): boolean {
  switch (toolId) {
    case 'moveVertex':
      return supports.moveVertex;
    case 'addVertex':
      return supports.insertVertex;
    case 'removeVertex':
      return supports.removeVertex;
    case 'splitWall':
      return supports.splitWall;
    case 'joinWalls':
      return supports.joinWalls;
    case 'resetHeight':
      return supports.changeHeight;
  }
}
