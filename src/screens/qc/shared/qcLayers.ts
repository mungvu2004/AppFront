import { ROUTES } from '@/routes/paths';
import { FLOOR_LAYERS, type FloorLayerKey } from '@/routes/projectSteps';

/**
 * Các thẻ của bước "Kiểm tra tầng", mỗi thẻ MỘT tên chuẩn (N1-03, N2-08).
 * Mọi chỗ gọi tên lớp (thanh lớp, breadcrumb, menu) đọc từ đây, không tự đặt tên khác.
 */
export type QcLayerKey = FloorLayerKey | 'scale' | 'overlay';

/** `layer`: ba lớp bắt buộc, đánh số 1–3; `tool`: công cụ của tầng — nhóm "Công cụ:" sau vạch ngăn. */
export type QcLayerGroup = 'layer' | 'tool';

export interface QcLayer {
  readonly key: QcLayerKey;
  readonly group: QcLayerGroup;
  /** Tên thẻ (ngắn). */
  readonly label: string;
  /** Tên màn = H1 (thẻ + động từ khi cần), dùng ở breadcrumb và H1 ẩn — CONTRACT mục 4. */
  readonly title: string;
  readonly route: (projectId: string, floorId: string) => string;
}

const floorLayer = (key: FloorLayerKey, group: QcLayerGroup): QcLayer => {
  const layer = FLOOR_LAYERS.find((item) => item.key === key)!;
  return { key, group, label: layer.label, title: layer.title, route: layer.path };
};

/* Thứ tự hiển thị (CONTRACT ux-2610 mục 3); thứ tự route FLOOR_LAYERS giữ nguyên. */
export const QC_LAYERS: readonly QcLayer[] = [
  floorLayer('walls', 'layer'),
  floorLayer('objects', 'layer'),
  floorLayer('rooms', 'layer'),
  { key: 'scale', group: 'tool', label: 'Tỷ lệ', title: 'Tỷ lệ bản vẽ', route: ROUTES.project.scale },
  floorLayer('grids', 'tool'),
  floorLayer('thickness', 'tool'),
  floorLayer('dimensions', 'tool'),
  { key: 'overlay', group: 'tool', label: 'So với bản vẽ', title: 'So với bản vẽ', route: ROUTES.project.overlay },
];

export function qcLayerTitle(key: QcLayerKey): string {
  return QC_LAYERS.find((layer) => layer.key === key)?.title ?? key;
}
