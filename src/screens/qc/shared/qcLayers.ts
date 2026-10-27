import { ROUTES } from '@/routes/paths';
import { FLOOR_LAYERS, type FloorLayerKey } from '@/routes/projectSteps';

/**
 * Các thẻ của bước "Kiểm tra tầng", mỗi thẻ MỘT tên chuẩn (N1-03, N2-08).
 * Mọi chỗ gọi tên lớp (thanh lớp, breadcrumb, menu) đọc từ đây, không tự đặt tên khác.
 */
export type QcLayerKey = FloorLayerKey | 'scale' | 'overlay';

/** `step`: bốn bước theo thứ tự, đánh số 0–3 (Tỷ lệ là bước 0); `advanced`: công cụ trong menu "Nâng cao". */
export type QcLayerGroup = 'step' | 'advanced';

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

/* Thứ tự hiển thị (UX-R1 K25): bốn bước rồi menu Nâng cao; thứ tự route FLOOR_LAYERS giữ nguyên. */
export const QC_LAYERS: readonly QcLayer[] = [
  { key: 'scale', group: 'step', label: 'Tỷ lệ', title: 'Tỷ lệ bản vẽ', route: ROUTES.project.scale },
  floorLayer('walls', 'step'),
  floorLayer('objects', 'step'),
  floorLayer('rooms', 'step'),
  floorLayer('grids', 'advanced'),
  floorLayer('thickness', 'advanced'),
  floorLayer('dimensions', 'advanced'),
  { key: 'overlay', group: 'advanced', label: 'So với bản vẽ', title: 'So với bản vẽ', route: ROUTES.project.overlay },
];

export function qcLayerTitle(key: QcLayerKey): string {
  return QC_LAYERS.find((layer) => layer.key === key)?.title ?? key;
}
