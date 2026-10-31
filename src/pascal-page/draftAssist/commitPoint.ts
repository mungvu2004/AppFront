/**
 * Dựng điểm cuối tường tại đúng toạ độ đã tính từ số gõ, bằng chính đường bấm chuột của Pascal (không
 * sửa `vendor/pascal`): tạm tắt bắt điểm để điểm không bị kéo về lưới/góc tường, rồi "bấm" vào đó.
 * - Có mặt bằng 2D (chế độ 2D/chia đôi): bấm lên SVG mặt bằng — nó tự tạo tường (2D) hoặc báo sang
 *   công cụ 3D (chia đôi), và tự nối đoạn tiếp theo.
 * - Chỉ 3D: phát `grid:click` dựa trên `grid:move` gần nhất (giữ độ cao mặt phẳng dựng).
 */
import { emitter, type GridEvent } from '@pascal-app/core';
import { useEditor } from '@pascal-app/editor';

import type { PlanPoint } from './typedLength';

const FLOORPLAN_SVG = 'svg[data-pascal-floorplan-2d]';
const FLOORPLAN_SCENE = '[data-floorplan-scene]';

export function commitWallPoint(point: PlanPoint, lastMove: GridEvent | null): boolean {
  const editor = useEditor.getState();
  const previous = editor.snappingModeByContext.wall;
  editor.setSnappingMode('wall', 'off');
  try {
    return editor.viewMode === '3d' ? emitGridClick(point, lastMove) : clickFloorplan(point);
  } finally {
    useEditor.getState().setSnappingMode('wall', previous);
  }
}

function clickFloorplan([x, z]: PlanPoint): boolean {
  const svg = document.querySelector<SVGSVGElement>(FLOORPLAN_SVG);
  const ctm = svg?.querySelector<SVGGraphicsElement>(FLOORPLAN_SCENE)?.getScreenCTM();
  if (!svg || !ctm) return false;
  const screen = new DOMPoint(x, z).matrixTransform(ctm);
  const click = new PointerEvent('click', {
    bubbles: true,
    cancelable: true,
    clientX: screen.x,
    clientY: screen.y,
    detail: 1,
    isPrimary: true,
    pointerType: 'mouse',
  });
  // Chrome cắt toạ độ sự kiện bấm về pixel nguyên — ở mức phóng thường là lệch ~5 mm. Mặt bằng đọc
  // `clientX/Y` ngay trên sự kiện, nên đặt lại giá trị lẻ chính xác (đo 01/11: 3500 → 3494 mm khi không có dòng này).
  Object.defineProperties(click, { clientX: { value: screen.x }, clientY: { value: screen.y } });
  svg.dispatchEvent(click);
  return true;
}

function emitGridClick([x, z]: PlanPoint, lastMove: GridEvent | null): boolean {
  if (!lastMove) return false;
  emitter.emit('grid:click', {
    ...lastMove,
    localPosition: [x, lastMove.localPosition[1], z],
    // Không có `target` canvas → công cụ tường coi như sự kiện tổng hợp, không bắn tia tìm mặt đỡ.
    nativeEvent: new PointerEvent('click', { detail: 1 }) as unknown as GridEvent['nativeEvent'],
  });
  return true;
}
