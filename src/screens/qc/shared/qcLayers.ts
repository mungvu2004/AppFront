import { ROUTES } from '@/routes/paths';
import { FLOOR_LAYERS, type FloorLayerKey } from '@/routes/projectSteps';

/**
 * Tám lớp của bước "Kiểm tra tầng", mỗi lớp MỘT tên chuẩn (N1-03, N2-08).
 * Mọi chỗ gọi tên lớp (thanh lớp, breadcrumb, menu) đọc từ đây, không tự đặt tên khác.
 */
export type QcLayerKey = FloorLayerKey | 'scale' | 'overlay';

export interface QcLayer {
  readonly key: QcLayerKey;
  readonly label: string;
  readonly route: (projectId: string, floorId: string) => string;
}

export const QC_LAYERS: readonly QcLayer[] = [
  ...FLOOR_LAYERS.map((layer) => ({ key: layer.key, label: layer.label, route: layer.path })),
  { key: 'scale', label: 'Tỷ lệ', route: ROUTES.project.scale },
  { key: 'overlay', label: 'Chồng lớp', route: ROUTES.project.overlay },
];

export function qcLayerLabel(key: QcLayerKey): string {
  return QC_LAYERS.find((layer) => layer.key === key)?.label ?? key;
}
