/**
 * Cảnh 3D chỉ đọc của trang chia sẻ (U17): người nhận liên kết xoay/phóng được ngôi nhà.
 *
 * Dùng lại `mountViewerScene` của trình xem 3D (worker dựng hình, vật liệu, vòng vẽ theo nhu cầu),
 * cấp đồ thị trả về từ `GET /share/{token}` thay vì store dự án. Không chọn được vật nào; camera
 * do tệp này lái: kéo để xoay, cuộn hoặc nút để phóng. Trang nạp lười tệp này (React.lazy) nên gói
 * three.js chỉ tải khi người nhận bấm sang thẻ 3D.
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { normalizeSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { SpatialGraph } from '@/domain/spatial/types';
import { prefersReducedMotion } from '@/lib/motion/reducedMotion';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { mountViewerScene } from '@/screens/viewer/Viewer3D/viewer3dScene';
import type { ViewerSceneHandle } from '@/screens/viewer/Viewer3D/viewer3dTypes';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import { fitViewBox } from './sharedPlanGeometry';

const ROTATE_PER_PX = 0.008;
const ZOOM_STEP = 1.25;
/** Góc chúc giữ trên mặt sàn và không lật qua đỉnh (0 = nhìn thẳng từ trên xuống). */
const MIN_POLAR = 0.2;
const MAX_POLAR = 1.45;
const DEFAULT_DISTANCE_M = 20;
const DISTANCE_MARGIN = 1.8;

/** Một bước xoay theo độ dời con trỏ; góc chúc bị kẹp, khoảng cách giữ nguyên. */
export function orbitFrame(frame: ViewerSceneFrame, dx: number, dy: number): ViewerSceneFrame {
  const polarRad = Math.min(MAX_POLAR, Math.max(MIN_POLAR, frame.polarRad - dy * ROTATE_PER_PX));
  return { ...frame, azimuthRad: frame.azimuthRad - dx * ROTATE_PER_PX, polarRad };
}

/** Phóng/thu: `factor` > 1 là lại gần; kẹp trong [0,2 ; 5] lần khoảng cách đầu. */
export function zoomFrame(frame: ViewerSceneFrame, factor: number, homeDistanceM: number): ViewerSceneFrame {
  const distanceM = Math.min(homeDistanceM * 5, Math.max(homeDistanceM * 0.2, frame.distanceM / factor));
  return { ...frame, distanceM };
}

function homeFrame(graph: SpatialGraph, levelId: string): ViewerSceneFrame {
  const box = fitViewBox(
    graph.walls.filter((wall) => wall.levelId === levelId),
    graph.rooms.filter((room) => room.levelId === levelId),
  );
  const sizeM = box === null ? 0 : Math.max(box.w, box.h) / 1000;
  return {
    azimuthRad: Math.PI / 4,
    polarRad: 0.95,
    distanceM: sizeM > 0 ? sizeM * DISTANCE_MARGIN : DEFAULT_DISTANCE_M,
    isOrthographic: false,
    visibleStoreyIds: [levelId],
    separation: 0,
    sectionPlane: null,
    selectedEntityIds: [],
    hoveredEntityId: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion: prefersReducedMotion(),
  };
}

function buildInputs(graph: SpatialGraph): readonly BuildFloorInput[] {
  const spatial = normalizeSpatial(graph);
  return graph.levels.flatMap((level) => {
    const input = toBuildFloorInput(spatial, level.id);
    return input === null ? [] : [input];
  });
}

export function SharedModel3D({ graph, levelId }: { readonly graph: SpatialGraph; readonly levelId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ViewerSceneHandle | null>(null);
  const frame = useRef<ViewerSceneFrame>(homeFrame(graph, levelId));
  const home = useRef<ViewerSceneFrame>(frame.current);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [failed, setFailed] = useState(false);

  const apply = (next: ViewerSceneFrame) => {
    frame.current = next;
    handle.current?.update(next);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;
    home.current = homeFrame(graph, levelId);
    frame.current = home.current;
    let levels: readonly BuildFloorInput[];
    try {
      levels = buildInputs(graph);
    } catch {
      setFailed(true);
      return undefined;
    }
    const mount = mountViewerScene(canvas, {
      levels,
      frame: frame.current,
      tokenOfPartKind: () => '--wall-idle',
      canSelect: false,
    });
    if (!mount.ok) {
      setFailed(true);
      return undefined;
    }
    handle.current = mount.handle;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      frame.current = zoomFrame(frame.current, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, home.current.distanceM);
      mount.handle.update(frame.current);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
      mount.handle.dispose();
      handle.current = null;
    };
  }, [graph, levelId]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (drag.current === null) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    apply(orbitFrame(frame.current, dx, dy));
  };
  const endDrag = () => {
    drag.current = null;
  };

  if (failed) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border-default bg-bg-surface p-6">
        <p className="text-sm text-text-secondary">Máy này không hiển thị được 3D. Mời xem mặt bằng ở thẻ 2D.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border-default bg-bg-surface">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Mô hình 3D chỉ đọc"
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      />
      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-md bg-bg-surface p-1 shadow-float">
        <Button variant="ghost" size="sm" iconOnly iconBefore={<Plus />} aria-label="Phóng to" title="Phóng to" onClick={() => { apply(zoomFrame(frame.current, ZOOM_STEP, home.current.distanceM)); }} />
        <Button variant="ghost" size="sm" iconOnly iconBefore={<Minus />} aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => { apply(zoomFrame(frame.current, 1 / ZOOM_STEP, home.current.distanceM)); }} />
        <Button variant="ghost" size="sm" iconOnly iconBefore={<Maximize />} aria-label="Về góc nhìn đầu" title="Về góc nhìn đầu" onClick={() => { apply(home.current); }} />
      </div>
      <p className="absolute bottom-3 left-3 rounded-md bg-bg-surface px-2 py-1 text-xs text-text-secondary">
        Kéo để xoay nhà, cuộn chuột để phóng to hoặc thu nhỏ.
      </p>
    </div>
  );
}
