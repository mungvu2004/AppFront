/**
 * Mặt bằng chỉ đọc của trang chia sẻ: phòng (nền + tên + diện tích), tường, cửa đi/cửa sổ, kèm
 * phóng/thu/vừa khung bằng nút, cuộn chuột để phóng quanh con trỏ, kéo để di chuyển (U23).
 *
 * Vẽ thẳng từ đồ thị trả về: các màn 2D/3D sẵn có đọc store của dự án đang mở, không nhận đồ thị.
 * Nơi dùng gắn `key` theo tầng: đổi tầng là gắn lại, camera về vừa khung.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { Opening, Room, Wall } from '@/domain/spatial/types';
import { formatArea } from '@/lib/format/measure';

import {
  cameraViewBox,
  fitCamera,
  fitViewBox,
  openingSegment,
  panCamera,
  roomLabelAnchor,
  zoomCamera,
  type PlanCamera,
  type ViewBox,
} from './sharedPlanGeometry';

const ZOOM_STEP = 1.4;
/** Cỡ chữ tên phòng so với cạnh dài bản vẽ. */
const LABEL_RATIO = 1 / 55;
/** Diện tích dưới mức này là bản vẽ chưa hiệu chỉnh tỉ lệ: không in số sai. */
const MIN_SHOWN_AREA_M2 = 1;

interface SharedPlanProps {
  readonly walls: readonly Wall[];
  readonly rooms: readonly Room[];
  readonly openings: readonly Opening[];
}

function RoomFigure({ room, fontSize }: { room: Room; fontSize: number }) {
  const anchor = roomLabelAnchor(room);
  // Tên dài hơn hộp thì co chữ cho vừa (ước 0,6 em mỗi ký tự).
  const size = anchor.width > 0 ? Math.min(fontSize, anchor.width / (room.name.length * 0.6)) : fontSize;

  return (
    <g>
      <polygon
        points={room.outline.map((point) => `${String(point.x)},${String(point.y)}`).join(' ')}
        fill="var(--accent-wash)"
        stroke="var(--border-control)"
        strokeWidth={fontSize / 10}
      />
      <text x={anchor.x} y={anchor.y} fontSize={size} textAnchor="middle" fill="var(--text-primary)">
        {room.name}
      </text>
      {room.areaM2 >= MIN_SHOWN_AREA_M2 ? (
        <text x={anchor.x} y={anchor.y + size * 1.2} fontSize={size * 0.8} textAnchor="middle" fill="var(--text-secondary)">
          {formatArea(room.areaM2)}
        </text>
      ) : null}
    </g>
  );
}

function OpeningFigure({ wall, opening }: { wall: Wall; opening: Opening }) {
  const segment = openingSegment(wall, opening);
  if (segment === null) {
    return null;
  }
  const line = { x1: segment.start.x, y1: segment.start.y, x2: segment.end.x, y2: segment.end.y };

  return (
    <g>
      {/* Khoét tường bằng màu nền, rồi cửa sổ vẽ một nét mảnh màu nhấn; cửa đi để trống. */}
      <line {...line} stroke="var(--canvas-2d)" strokeWidth={wall.thicknessMm * 1.1} />
      {opening.kind === 'window' ? (
        <line {...line} stroke="var(--accent)" strokeWidth={wall.thicknessMm * 0.35} />
      ) : null}
    </g>
  );
}

function toPlanPoint(svg: SVGSVGElement, view: ViewBox, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  // `preserveAspectRatio` mặc định (xMidYMid meet): một tỉ lệ chung, phần thừa chia đều hai bên.
  const scale = Math.min(rect.width / view.w, rect.height / view.h) || 1;
  const offsetX = (rect.width - view.w * scale) / 2;
  const offsetY = (rect.height - view.h * scale) / 2;

  return { x: view.x + (clientX - rect.left - offsetX) / scale, y: view.y + (clientY - rect.top - offsetY) / scale, scale };
}

export function SharedPlan({ walls, rooms, openings }: SharedPlanProps) {
  const fit = useMemo(() => fitViewBox(walls, rooms), [walls, rooms]);
  const [camera, setCamera] = useState<PlanCamera | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const current = fit === null ? null : (camera ?? fitCamera(fit));
  const view = fit === null || current === null ? null : cameraViewBox(fit, current);

  // Cuộn chuột phóng quanh con trỏ; cần listener không thụ động để chặn trang cuộn theo.
  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null || fit === null || view === null) {
      return undefined;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = toPlanPoint(svg, view, event.clientX, event.clientY);
      setCamera((prev) => zoomCamera(prev ?? fitCamera(fit), event.deltaY < 0 ? 1.15 : 1 / 1.15, at));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', onWheel);
    };
  }, [fit, view]);

  if (fit === null || view === null || current === null) {
    return <p className="text-sm text-text-secondary">Tầng này chưa có tường hay phòng nào.</p>;
  }

  const fontSize = Math.max(fit.w, fit.h) * LABEL_RATIO;
  const wallById = new Map(walls.map((wall) => [wall.id, wall]));

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    drag.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current === null || svgRef.current === null) {
      return;
    }
    const { scale } = toPlanPoint(svgRef.current, view, event.clientX, event.clientY);
    const dx = (event.clientX - drag.current.x) / scale;
    const dy = (event.clientY - drag.current.y) / scale;
    drag.current = { x: event.clientX, y: event.clientY };
    setCamera((prev) => panCamera(prev ?? fitCamera(fit), dx, dy));
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border-default bg-canvas-2d">
      <svg
        ref={svgRef}
        role="img"
        aria-label="Mặt bằng chỉ đọc"
        viewBox={`${String(view.x)} ${String(view.y)} ${String(view.w)} ${String(view.h)}`}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {rooms.map((room) => (
          <RoomFigure key={room.id} room={room} fontSize={fontSize} />
        ))}
        {walls.map((wall) => (
          <line
            key={wall.id}
            x1={wall.centreline.start.x}
            y1={wall.centreline.start.y}
            x2={wall.centreline.end.x}
            y2={wall.centreline.end.y}
            stroke="var(--text-primary)"
            strokeWidth={wall.thicknessMm}
            strokeLinecap="square"
          />
        ))}
        {openings.map((opening) => {
          const wall = wallById.get(opening.wallId);
          return wall === undefined ? null : <OpeningFigure key={opening.id} wall={wall} opening={opening} />;
        })}
      </svg>
      <div className="absolute right-3 top-3 flex flex-col gap-1 rounded-md bg-bg-surface p-1 shadow-float">
        <Button variant="ghost" size="sm" iconOnly iconBefore={<Plus />} aria-label="Phóng to" title="Phóng to" onClick={() => { setCamera(zoomCamera(current, ZOOM_STEP)); }} />
        <Button variant="ghost" size="sm" iconOnly iconBefore={<Minus />} aria-label="Thu nhỏ" title="Thu nhỏ" onClick={() => { setCamera(zoomCamera(current, 1 / ZOOM_STEP)); }} />
        <Button variant="ghost" size="sm" iconOnly iconBefore={<Maximize />} aria-label="Vừa khung" title="Vừa khung" onClick={() => { setCamera(null); }} />
      </div>
      <p className="absolute bottom-3 left-3 rounded-md bg-bg-surface px-2 py-1 text-xs text-text-secondary">
        Kéo để di chuyển, cuộn chuột để phóng to hoặc thu nhỏ.
      </p>
    </div>
  );
}
