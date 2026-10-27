import { ROUTES } from '@/routes/paths';
import { FLOOR_LAYERS, type FloorLayerKey } from '@/routes/projectSteps';

/**
 * Các thẻ của bước "Kiểm tra tầng", mỗi thẻ MỘT tên chuẩn (N1-03, N2-08).
 * Mọi chỗ gọi tên lớp (thanh lớp, breadcrumb, menu) đọc từ đây, không tự đặt tên khác.
 */
export type QcLayerKey = FloorLayerKey | 'scale' | 'overlay';

/**
 * `step`: bốn bước bắt buộc theo thứ tự, đánh số 1–4; `tool`: màn phụ, không có mục riêng trên
 * thanh bước (UX-R2 K04: bỏ menu "Nâng cao").
 */
export type QcLayerGroup = 'step' | 'tool';

export interface QcLayer {
  readonly key: QcLayerKey;
  readonly group: QcLayerGroup;
  /** Tên thẻ (ngắn). */
  readonly label: string;
  /** Tên màn = H1 (thẻ + động từ khi cần), dùng ở breadcrumb và H1 ẩn — CONTRACT mục 4. */
  readonly title: string;
  readonly route: (projectId: string, floorId: string) => string;
  /**
   * Màn phụ thuộc bước nào: đứng ở màn phụ thì bước đó sáng trên thanh bước. Kích thước và So với
   * bản vẽ là mục con của bước Tỷ lệ (K31); Độ dày là việc của bước Tường, mở bằng nút "Đưa N tường
   * về chuẩn" (K24); Trục không thuộc bước nào, chỉ mở từ màn Các tầng.
   */
  readonly parent?: QcLayerKey;
  /** Mục con hiện thành link trong bước cha (Kích thước, So với bản vẽ); vắng = chỉ hiện khi đang đứng ở đó. */
  readonly listed?: boolean;
}

const floorLayer = (key: FloorLayerKey, group: QcLayerGroup, extra: Pick<QcLayer, 'parent' | 'listed'> = {}): QcLayer => {
  const layer = FLOOR_LAYERS.find((item) => item.key === key)!;
  return { key, group, label: layer.label, title: layer.title, route: layer.path, ...extra };
};

/* Thứ tự hiển thị (UX-R2): bốn bước rồi các màn phụ; thứ tự route FLOOR_LAYERS giữ nguyên. */
export const QC_LAYERS: readonly QcLayer[] = [
  { key: 'scale', group: 'step', label: 'Tỷ lệ', title: 'Tỷ lệ bản vẽ', route: ROUTES.project.scale },
  floorLayer('walls', 'step'),
  floorLayer('objects', 'step'),
  floorLayer('rooms', 'step'),
  floorLayer('dimensions', 'tool', { parent: 'scale', listed: true }),
  { key: 'overlay', group: 'tool', label: 'So với bản vẽ', title: 'So với bản vẽ', route: ROUTES.project.overlay, parent: 'scale', listed: true },
  floorLayer('thickness', 'tool', { parent: 'walls' }),
  floorLayer('grids', 'tool'),
];

/** Bước đang sáng trên thanh bước khi đứng ở `key`: chính nó, bước cha của màn phụ, hoặc `null` (Trục). */
export function qcStepOf(key: QcLayerKey): QcLayerKey | null {
  const layer = QC_LAYERS.find((item) => item.key === key);
  if (layer === undefined) return null;
  return layer.group === 'step' ? layer.key : (layer.parent ?? null);
}

export function qcLayerTitle(key: QcLayerKey): string {
  return QC_LAYERS.find((layer) => layer.key === key)?.title ?? key;
}
