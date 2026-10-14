/**
 * Khung React bọc `<Viewer>` của Pascal.
 *
 * Tách khỏi `pascalMount.tsx` vì `react-refresh/only-export-components`: một tệp
 * vừa xuất hàm thường vừa khai component thì fast refresh không chạy được.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { emitter } from '@pascal-app/core';
import {
  appFrontEditorPanels,
  Editor,
  runUndo,
  subscribeHistoryJumps,
  subscribeMeasurementDeletes,
  useEditor,
} from '@pascal-app/editor';
import {
  computeHeroFraming,
  heroCameraPose,
  useLevelExplode,
  useViewer,
  Viewer,
} from '@pascal-app/viewer';
import { useThree } from '@react-three/fiber';

import type { PascalScene } from '@/lib/pascal/types';

import { createPickMeasure } from './pascalPick';
import {
  BUILTIN_PLUGIN_ID,
  loadPascalPlugins,
  loadSceneIntoPascal,
  type PascalSceneCensus,
} from './pascalScene';
import type {
  PascalCommitVerdict,
  PascalTemplateResult,
  PascalInitialTool,
  PascalHistoryJump,
  PascalMeasureResult,
  PascalMeasurementDelete,
  PascalMountMode,
  PascalSaveStatus,
} from './pascalMountTypes';

export interface PascalFrameProps {
  readonly scene: PascalScene;
  /**
   * `view` dựng `<Viewer>` — khung xem thuần, không công cụ nào.
   * `edit` dựng `<Editor>`, và khi ấy chính editor nạp cảnh qua `onLoad`.
   */
  readonly mode: PascalMountMode;
  /** Chỉ ở `view`: bật điều khiển camera chạm/chuột của `<Viewer>` (F-15 S1). */
  readonly cameraControls?: boolean;
  /** Vai chỉ-xem. Chỉ có nghĩa ở `edit`; `view` vốn đã không sửa được gì. */
  readonly readOnly: boolean;
  /**
   * Cảnh sau một lượt sửa, để màn hình đổi nó thành lệnh AppFront.
   *
   * **Bắt buộc có ở `edit`.** Không truyền thì `useAutoSave` của Pascal rơi về
   * `localStorage` — tức bản vẽ của người dùng nằm trong trình duyệt chứ không
   * trên máy chủ, và A7 ("hệ thống tự lưu") thành một lời nói dối.
   */
  readonly onSceneCommit: ((scene: PascalScene) => Promise<void>) | undefined;
  readonly onSaveStatus: ((status: PascalSaveStatus) => void) | undefined;
  /** Phán quyết 6A, chạy TRƯỚC khi lượt sửa vào lịch sử và vào đường lưu. */
  readonly validateCommit: ((scene: PascalScene) => PascalCommitVerdict) | undefined;
  /** Lý do một lượt sửa bị chặn, để màn hình nói ra bằng tiếng Việt. */
  readonly onCommitRejected: ((message: string) => void) | undefined;
  /** "Lưu làm khuôn mẫu" (#25) — vắng thì editor không hiện nút. */
  readonly onSaveAsTemplate?: ((nodeId: string) => Promise<PascalTemplateResult>) | undefined;
  /** Công cụ bật sẵn khi editor đã nạp xong cảnh — xem `PascalInitialTool`. */
  readonly initialTool?: PascalInitialTool | undefined;
  /**
   * **Phải đổi mỗi lần nạp cảnh mới.** Đo được: để nó cố định thì viewer giữ
   * nguyên phán quyết "sẵn sàng" của cảnh trước và không bao giờ nói lại.
   */
  readonly sceneKey: number;
  readonly onReadyChange: ((ready: boolean) => void) | undefined;
  readonly onFatal: ((error: Error) => void) | undefined;
  /**
   * Số đo của lượt nạp, sau khi store đã dọn.
   *
   * Store Pascal **im lặng** bỏ node mồ côi và node không với tới được từ
   * `rootNodeIds`. `loadSceneIntoPascal` trả số đo ấy ra từ đầu, nhưng trước
   * đây không ai nghe — nên một tấm sàn bị dọn đi là một mặt sàn biến mất mà
   * màn hình vẫn nói "xong".
   */
  readonly onSceneLoaded: ((census: PascalSceneCensus) => void) | undefined;
  /**
   * Máy không dựng được WebGPU lẫn WebGL.
   *
   * Không có nó thì `<Viewer>` (cả cái nằm trong `<Editor>`) dựng thẻ dự phòng
   * CỦA RIÊNG NÓ (`viewer/src/components/viewer/unsupported-gpu-fallback.tsx`):
   * màu viết cứng (nền hex fafafa, chữ neutral-900), và báo "đã sẵn sàng" nên
   * màn nói "Đã dựng xong" trên một khung không vẽ gì (23-B-016).
   */
  readonly onRendererUnavailable: (() => void) | undefined;
  /**
   * Người dùng vừa hoàn tác hoặc làm lại (A8 — mọi thay đổi hoàn tác được,
   * kèm toast hoàn tác).
   *
   * Chỉ cú nhảy THẬT của người dùng đi qua đây. Hai chỗ khác trong Pascal gọi
   * thẳng `useScene.temporal.undo()` — `use-auto-save` lùi một lượt sửa bị
   * `validateCommit` chặn, và bộ quản affordance chọn lùi một lượt thay thế
   * hỏng — cả hai không phải việc người dùng bấm, nên không báo ra.
   */
  readonly onHistoryJump: ((kind: PascalHistoryJump) => void) | undefined;
  /** Người dùng vừa xoá một phép đo — màn dựng toast có nút hoàn tác (#63). */
  readonly onMeasurementDelete?: ((event: PascalMeasurementDelete) => void) | undefined;
  /** Bật tách tầng hết cỡ khi khung đứng lên — `/3d?view=exploded`. */
  readonly explodeLevels?: boolean;
  /** Chạm chọn ở `view` — xem `PascalMountOptions.onPick`. */
  readonly onPick?: ((nodeId: string | null) => void) | undefined;
  readonly measure?: boolean;
  readonly onMeasure?: ((result: PascalMeasureResult) => void) | undefined;
  /** Chỉ ở `view`: post-FX tắt cho tới khi lần nạp đầu xong. */
  readonly lite?: boolean;
}

/** `fov` của `PerspectiveCamera` mà `ViewerCamera` của Pascal dựng (`viewer-camera.tsx`). */
const VIEWER_FOV_DEG = 50;

/**
 * Đặt camera đóng khung cả mô hình khi cảnh đã dựng xong (BUG-482).
 *
 * `<Viewer>` của Pascal dựng camera ở `[10, 10, 10]` và KHÔNG ngắm vào đâu —
 * bộ điều khiển camera nằm ở gói editor, AppFront không nhúng. Nên camera nhìn
 * thẳng theo trục −Z: chỉ thấy trời, mặt đất và một góc tường. Dùng đúng cặp hàm
 * Pascal dùng cho ảnh đại diện (`computeHeroFraming` + `heroCameraPose`), chạy lại
 * mỗi khi cảnh mới sẵn sàng hoặc khung đổi tỷ lệ (375 dọc khác 1440 ngang).
 */
export function HeroCamera({ ready }: { readonly ready: boolean }) {
  const camera = useThree((state) => state.camera);
  const width = useThree((state) => state.size.width);
  const height = useThree((state) => state.size.height);

  useEffect(() => {
    if (!ready || width === 0 || height === 0) return;

    const framing = computeHeroFraming();
    if (framing === null) return;

    const pose = heroCameraPose({
      aim: framing.aim,
      aspect: width / height,
      azimuthRad: framing.azimuthRad,
      boxes: framing.boxes,
      fovDeg: VIEWER_FOV_DEG,
    });

    camera.position.set(...pose.position);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
  }, [camera, height, ready, width]);

  return null;
}

export function PascalFrame({
  scene,
  sceneKey,
  mode,
  cameraControls = false,
  readOnly,
  onSceneCommit,
  onSaveStatus,
  validateCommit,
  onCommitRejected,
  onSaveAsTemplate,
  onReadyChange,
  onFatal,
  onSceneLoaded,
  onRendererUnavailable,
  initialTool,
  onHistoryJump,
  onMeasurementDelete,
  explodeLevels = false,
  onPick,
  measure = false,
  onMeasure,
  lite = false,
}: PascalFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  /* `/3d?tool=measure`: bật công cụ đo một lần, khi editor đã đứng. Vai chỉ xem
     vẫn đo được (#67) — đo không ghi gì vào cảnh. */
  useEffect(() => {
    if (mode !== 'edit' || !ready || initialTool !== 'measure') return;
    /* Cùng đường với phím M của Pascal (`editor/src/hooks/use-keyboard.ts`). */
    const editor = useEditor.getState();
    editor.setPhase('structure');
    editor.setStructureLayer('elements');
    editor.setToolDefaults('measurement', { kind: editor.lastMeasurementKind });
    editor.armToolMode({ mode: 'build', tool: 'measurement' });
  }, [initialTool, mode, ready]);

  /* Chạm chọn / đo ở `view`: nghe bus của core (viewer phát `node:click` khi
     bấm vào node, `grid:click` khi bấm ra nền), không cần sửa vendor. */
  useEffect(() => {
    if (mode !== 'view' || (onPick === undefined && !measure)) return undefined;
    const handle = createPickMeasure({ measure, onPick, onMeasure });
    const onNode = (event: { node: { id: string }; position: [number, number, number] }) =>
      handle(event.node.id, event.position);
    const onGrid = (event: { position: [number, number, number] }) => handle(null, event.position);
    emitter.on('node:click', onNode);
    emitter.on('grid:click', onGrid);
    return () => {
      emitter.off('node:click', onNode);
      emitter.off('grid:click', onGrid);
    };
  }, [mode, measure, onPick, onMeasure]);

  useEffect(() => {
    if (!explodeLevels) return;
    useLevelExplode.getState().setAmount(1);
    useViewer.getState().setLevelMode('exploded');
  }, [explodeLevels]);

  useEffect(() => {
    if (mode === 'edit') return;

    let cancelled = false;

    loadSceneIntoPascal(scene)
      .then((census) => {
        if (cancelled) return;
        onSceneLoaded?.(census);
        setLoaded(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) onFatal?.(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      cancelled = true;
    };
  }, [mode, scene, onFatal, onSceneLoaded]);

  /* Đăng ký ở gốc thứ hai, không ở màn: `subscribeHistoryJumps` là một ô
     chứa ở mức module của gói Pascal, mà gói ấy chỉ tồn tại trong lượt dựng
     này. Chỉ ở `edit` — `<Viewer>` thuần không có lịch sử để nhảy. */
  useEffect(() => {
    if (mode !== 'edit' || onHistoryJump === undefined) return undefined;
    return subscribeHistoryJumps(onHistoryJump);
  }, [mode, onHistoryJump]);

  useEffect(() => {
    if (mode !== 'edit' || onMeasurementDelete === undefined) return undefined;
    return subscribeMeasurementDeletes(({ ordinal }) => onMeasurementDelete({ ordinal, undo: runUndo }));
  }, [mode, onMeasurementDelete]);

  const handleReady = useCallback(
    (nextReady: boolean) => {
      setReady(nextReady);
      if (nextReady) setFirstLoadDone(true);
      onReadyChange?.(nextReady);
    },
    [onReadyChange],
  );

  /**
   * Cửa nạp của editor.
   *
   * Editor tự gọi `setScene` qua `applySceneGraphToEditor`, nên ở nhánh này
   * KHÔNG gọi `loadSceneIntoPascal` — hai lượt nạp chồng nhau thì lượt sau huỷ
   * lượt hydration của lượt trước. Nhưng registry node vẫn phải đầy trước đó:
   * thiếu nó thì cảnh vào store mà không loại node nào vẽ được.
   */
  const handleLoad = useCallback(async () => {
    await loadPascalPlugins();
    onSceneLoaded?.({ nodeCount: Object.keys(scene.nodes).length, droppedIds: [] });

    return {
      nodes: scene.nodes as Record<string, unknown>,
      rootNodeIds: [...scene.rootNodeIds],
      installedPlugins: [BUILTIN_PLUGIN_ID],
    };
  }, [scene, onSceneLoaded]);

  const handleSave = useCallback(
    async (next: unknown): Promise<void> => {
      await onSceneCommit?.(next as PascalScene);
    },
    [onSceneCommit],
  );

  const handleValidate = useMemo(
    () =>
      validateCommit === undefined
        ? undefined
        : (next: unknown) => validateCommit(next as PascalScene),
    [validateCommit],
  );

  if (mode === 'edit') {
    return (
      <Editor
        guardAgainstSceneWipe
        readOnly={readOnly}
        /* Bảng phụ của AppFront (F-15 W2-D). Danh sách khai TRONG vendor vì
           `ExtraPanel.component` là một component React, mà Pascal chạy ở gốc
           React thứ hai với bản React riêng — component dựng ở đây sẽ do bộ
           dựng sai khởi tạo. Xem `components/ui/panels/appfront-panels.tsx`. */
        extraSidebarPanels={appFrontEditorPanels}
        onLoad={handleLoad}
        onSave={handleSave}
        {...(onSaveStatus === undefined ? {} : { onSaveStatusChange: onSaveStatus })}
        /* Editor không có `onSceneReadyChange`; `onLoaderChange` là cùng một
           tín hiệu nhìn từ phía kia. Thiếu dòng này thì màn kẹt "đang nạp"
           vĩnh viễn, vì `ready` của hook chỉ đến từ khung nhúng. */
        onLoaderChange={(visible) => handleReady(!visible)}
        {...(handleValidate === undefined ? {} : { validateCommit: handleValidate })}
        {...(onCommitRejected === undefined ? {} : { onCommitRejected })}
        {...(onSaveAsTemplate === undefined || readOnly ? {} : { onSaveAsTemplate })}
        /* 23-B-016 — thiếu dòng này thì Viewer bên trong editor dựng thẻ của
           Pascal và báo "xong", màn nói "Đã dựng xong" trên một khung không vẽ. */
        {...(onRendererUnavailable === undefined ? {} : { onRendererUnavailable })}
      />
    );
  }

  if (!loaded) return null;

  return (
    <Viewer
      cameraControls={cameraControls}
      sceneReadyKey={sceneKey}
      disablePostFx={lite && !firstLoadDone}
      onSceneReadyChange={handleReady}
      {...(onRendererUnavailable === undefined ? {} : { onRendererUnavailable })}
    >
      <HeroCamera ready={ready} />
    </Viewer>
  );
}
