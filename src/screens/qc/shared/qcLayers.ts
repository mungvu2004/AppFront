import { ROUTES } from '@/routes/paths';
import { FLOOR_LAYERS, type FloorLayerKey } from '@/routes/projectSteps';

/**
 * Tám lớp của bước "Kiểm tra tầng", mỗi lớp MỘT tên chuẩn (N1-03, N2-08).
 * Mọi chỗ gọi tên lớp (thanh lớp, breadcrumb, menu) đọc từ đây, không tự đặt tên khác.
 */
export type QcLayerKey = FloorLayerKey | 'scale' | 'overlay';

/** `layer`: lớp duyệt; `tool`: công cụ của tầng (Tỷ lệ, Chồng lớp) — nhóm riêng cuối dải, sau vạch ngăn (như `FLOOR_TOOL_SCREENS`). */
export type QcLayerGroup = 'layer' | 'tool';

export interface QcLayer {
  readonly key: QcLayerKey;
  readonly group: QcLayerGroup;
  readonly label: string;
  readonly route: (projectId: string, floorId: string) => string;
}

export const QC_LAYERS: readonly QcLayer[] = [
  ...FLOOR_LAYERS.map((layer) => ({ key: layer.key, group: 'layer' as const, label: layer.label, route: layer.path })),
  { key: 'scale', group: 'tool', label: 'Tỷ lệ', route: ROUTES.project.scale },
  { key: 'overlay', group: 'tool', label: 'Chồng lớp', route: ROUTES.project.overlay },
];

export function qcLayerLabel(key: QcLayerKey): string {
  return QC_LAYERS.find((layer) => layer.key === key)?.label ?? key;
}

/** Dòng tiến độ ở đầu màn: "x/y đã duyệt"; chưa có gì để duyệt thì `null` (khe ẩn gọn). */
export function qcProgressLabel(reviewed: number, total: number): string | null {
  return total === 0 ? null : `${reviewed}/${total} đã duyệt`;
}
