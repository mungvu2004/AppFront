/**
 * Cảnh 3D chỉ đọc của trang chia sẻ (U17): người nhận liên kết xoay/phóng được ngôi nhà.
 *
 * Dùng lại `mountViewerScene` của trình xem 3D (worker dựng hình, vật liệu, vòng vẽ theo nhu cầu),
 * cấp đồ thị trả về từ `GET /share/{token}` thay vì store dự án. Không chọn được vật nào; camera
 * do tệp này lái: kéo để xoay, cuộn hoặc nút để phóng. Trang nạp lười tệp này (React.lazy) nên gói
 * three.js chỉ tải khi người nhận bấm sang thẻ 3D.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { SpatialGraph } from '@/domain/spatial/types';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { mountViewerScene } from '@/screens/viewer/Viewer3D/viewer3dScene';
import type { ViewerSceneHandle } from '@/screens/viewer/Viewer3D/viewer3dTypes';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import {
  buildInputs,
  homeFrame,
  orbitFrame,
  roomLabels,
  tokenOfSharedEntity,
  tokenOfSharedPart,
  ZOOM_STEP,
  zoomFrame,
} from './sharedModel3dFrame';


interface SharedModel3DProps {
  readonly graph: SpatialGraph;
  readonly levelId: string;
  /** Tầng chưa đặt tỷ lệ: diện tích trên nhãn phòng ghi " (tạm)" (UX-23). */
  readonly provisionalArea?: boolean;
}

export function SharedModel3D({ graph, levelId, provisionalArea = false }: SharedModel3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const labels = useMemo(() => roomLabels(graph, levelId, provisionalArea), [graph, levelId, provisionalArea]);
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
      tokenOfPartKind: tokenOfSharedPart,
      tokenOfEntity: tokenOfSharedEntity(graph),
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
    // Nhãn tên phòng bám theo camera (UX-11): chiếu tâm phòng ra màn mỗi khung, đặt thẳng bằng style.
    let raf = 0;
    const placeLabels = () => {
      for (const label of labels) {
        const element = labelRefs.current.get(label.id);
        if (element === undefined) continue;
        const at = mount.handle.projectToScreen?.(label.at.x, label.at.y, label.at.z) ?? null;
        element.style.visibility = at === null ? 'hidden' : 'visible';
        if (at !== null) element.style.transform = `translate(${at.x}px, ${at.y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(placeLabels);
    };
    raf = requestAnimationFrame(placeLabels);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('wheel', onWheel);
      mount.handle.dispose();
      handle.current = null;
    };
  }, [graph, levelId, labels]);

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
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {labels.map((label) => (
          <div
            key={label.id}
            ref={(element) => {
              if (element === null) labelRefs.current.delete(label.id);
              else labelRefs.current.set(label.id, element);
            }}
            className="invisible absolute left-0 top-0 whitespace-nowrap rounded bg-bg-surface px-1.5 py-0.5 text-center text-xs leading-tight text-text-primary shadow-float"
          >
            <span className="block font-medium">{label.name}</span>
            {label.area === null ? null : <span className="block text-text-secondary">{label.area}</span>}
          </div>
        ))}
      </div>
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
