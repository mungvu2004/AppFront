/**
 * Phần không phải component của `WallLayerCanvas`: nhóm lệnh menu chuột phải và phép đổi toạ độ
 * con trỏ (để `WallLayerCanvasParts.tsx` chỉ xuất component — luật fast refresh).
 */

import type { ContextMenuGroup } from '@/hooks/useContextMenu';

import type { WallLayerCanvasViewProps as Props } from './wallLayerHatch';

type WallId = NonNullable<Props['selectedWallId']>;

/* Chuỗi tiếng Việt tĩnh — khớp `i18n.fragment.json` của màn (A6). */
const MENU_LABELS = {
  approve: 'Duyệt',
  changeThickness: 'Đổi độ dày',
  split: 'Tách đoạn',
  remove: 'Xoá',
} as const;

/**
 * Toạ độ PIXEL BẢN VẼ của một điểm màn hình: `getScreenCTM().inverse()` của `<svg>` (mang
 * `viewBox` pixel bản vẽ) đã gộp dịch và phóng. jsdom không cài `getScreenCTM` → `null`.
 */
export function drawingPointOf(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
): { readonly xPx: number; readonly yPx: number } | null {
  const matrix = svg.getScreenCTM?.();

  if (matrix === null || matrix === undefined) {
    return null;
  }

  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());

  return { xPx: point.x, yPx: point.y };
}

/** Nhóm lệnh menu chuột phải của một tường. Tường đã duyệt: "Duyệt" không làm gì, nên không đưa ra (BUG-604). */
export function wallMenuGroups(
  wallId: WallId,
  isReviewed: boolean,
  { onApprove, onDelete, onRequestSplit, onRequestThicknessChange }: Pick<
    Props,
    'onApprove' | 'onDelete' | 'onRequestSplit' | 'onRequestThicknessChange'
  >,
): ContextMenuGroup[] {
  return [
    {
      id: 'wall',
      items: [
        ...(isReviewed ? [] : [{ id: 'approve', label: MENU_LABELS.approve, action: () => onApprove(wallId) }]),
        { id: 'thickness', label: MENU_LABELS.changeThickness, action: () => onRequestThicknessChange(wallId) },
        { id: 'split', label: MENU_LABELS.split, action: () => onRequestSplit(wallId) },
        { id: 'remove', label: MENU_LABELS.remove, isDestructive: true, action: () => onDelete(wallId) },
      ],
    },
  ];
}
