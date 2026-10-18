/**
 * Khung React bọc `<Viewer>` của Pascal — chỉ còn chế độ xem.
 *
 * Trình soạn thảo đầy đủ nay là trang riêng `public/editor3d.html` (Pascal
 * nguyên bản), nên khung nhúng này chỉ dựng `<Viewer>` cho màn di động và so
 * sánh phiên bản.
 *
 * Tách khỏi `pascalMount.tsx` vì `react-refresh/only-export-components`: một tệp
 * vừa xuất hàm thường vừa khai component thì fast refresh không chạy được.
 */

import { useCallback, useEffect, useState } from 'react';
import { emitter } from '@pascal-app/core';
import { computeHeroFraming, heroCameraPose, Viewer } from '@pascal-app/viewer';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

import type { PascalScene } from '@/lib/pascal/types';

import { createPickMeasure } from './pascalPick';
import { loadSceneIntoPascal, type PascalSceneCensus } from './pascalScene';
import type { PascalMeasureResult } from './pascalMountTypes';

export interface PascalFrameProps {
  readonly scene: PascalScene;
  /** Bật điều khiển camera chạm/chuột (xoay, thu phóng, dời) — `OrbitControls` của drei. */
  readonly cameraControls?: boolean;
  /**
   * **Phải đổi mỗi lần nạp cảnh mới.** Đo được: để nó cố định thì viewer giữ
   * nguyên phán quyết "sẵn sàng" của cảnh trước và không bao giờ nói lại.
   */
  readonly sceneKey: number;
  readonly onReadyChange: ((ready: boolean) => void) | undefined;
  readonly onFatal: ((error: Error) => void) | undefined;
  /**
   * Số đo của lượt nạp, sau khi store đã dọn. Store Pascal **im lặng** bỏ node
   * mồ côi và node không với tới được từ `rootNodeIds`.
   */
  readonly onSceneLoaded: ((census: PascalSceneCensus) => void) | undefined;
  /** Chạm chọn — xem `PascalMountOptions.onPick`. */
  readonly onPick?: ((nodeId: string | null) => void) | undefined;
  readonly measure?: boolean;
  readonly onMeasure?: ((result: PascalMeasureResult) => void) | undefined;
  /** Post-FX tắt cho tới khi lần nạp đầu xong. */
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
  // `OrbitControls makeDefault` tự ngắm về tâm của nó — dời tâm theo khung hình.
  const controls = useThree((state) => state.controls) as {
    target?: { set: (x: number, y: number, z: number) => void };
    update?: () => void;
  } | null;

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
    controls?.target?.set(...pose.target);
    controls?.update?.();
  }, [camera, controls, height, ready, width]);

  return null;
}

export function PascalFrame({
  scene,
  sceneKey,
  cameraControls = false,
  onReadyChange,
  onFatal,
  onSceneLoaded,
  onPick,
  measure = false,
  onMeasure,
  lite = false,
}: PascalFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  /* Chạm chọn / đo: nghe bus của core (viewer phát `node:click` khi bấm vào
     node, `grid:click` khi bấm ra nền), không cần sửa vendor. */
  useEffect(() => {
    if (onPick === undefined && !measure) return undefined;
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
  }, [measure, onPick, onMeasure]);

  useEffect(() => {
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
  }, [scene, onFatal, onSceneLoaded]);

  const handleReady = useCallback(
    (nextReady: boolean) => {
      setReady(nextReady);
      if (nextReady) setFirstLoadDone(true);
      onReadyChange?.(nextReady);
    },
    [onReadyChange],
  );

  if (!loaded) return null;

  return (
    <Viewer
      sceneReadyKey={sceneKey}
      disablePostFx={lite && !firstLoadDone}
      onSceneReadyChange={handleReady}
    >
      <HeroCamera ready={ready} />
      {cameraControls ? <OrbitControls makeDefault /> : null}
    </Viewer>
  );
}
