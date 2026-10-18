/**
 * Sáu bước của một dự án, theo đúng thứ tự người dùng đi: tải bản vẽ → xử lý
 * → kiểm tra tầng → mô hình 3D → quy chuẩn → xuất. Header chung đọc bảng này để
 * vẽ thanh bước và nút "Bước tiếp theo" ở mọi màn `/projects/:projectId/*`.
 *
 * Chỉ nhập `./paths` (file không nhập gì), nên không vòng nào đi qua đây.
 */
import { ROUTES } from './paths';

export interface ProjectStep {
  readonly id: 'upload' | 'pipeline' | 'floors' | 'viewer' | 'rules' | 'export';
  readonly label: string;
  readonly path: (projectId: string) => string;
  /** Đoạn đường sau `/projects/:projectId/` thuộc về bước này. */
  readonly segments: readonly string[];
}

export const PROJECT_STEPS: readonly ProjectStep[] = [
  { id: 'upload', label: 'Tải bản vẽ', path: ROUTES.project.upload, segments: ['upload'] },
  { id: 'pipeline', label: 'Xử lý', path: ROUTES.project.pipeline, segments: ['pipeline'] },
  { id: 'floors', label: 'Kiểm tra tầng', path: ROUTES.project.floors, segments: ['floors'] },
  { id: 'viewer', label: 'Mô hình 3D', path: ROUTES.project.viewer, segments: ['3d'] },
  { id: 'rules', label: 'Quy chuẩn', path: ROUTES.project.rules, segments: ['rules'] },
  { id: 'export', label: 'Xuất', path: ROUTES.project.export, segments: ['export'] },
];

/**
 * Màn của dự án nằm ngoài sáu bước (lịch sử phiên bản, dữ liệu, sơ đồ xử lý,
 * chất lượng đầu vào, cài đặt): thanh bước không sáng ô nào. Đường nào không
 * thuộc bước lẫn danh sách này là trang 404, header không vẽ thanh bước.
 */
const OFF_STEP_SEGMENTS: readonly string[] = ['quality', 'versions', 'data', 'settings'];

/** Thứ tự duyệt các lớp của một tầng trong bước 3 (cùng thứ tự dải thẻ lớp trên màn). */
export type FloorLayerKey = 'walls' | 'objects' | 'rooms' | 'dimensions' | 'grids' | 'thickness';

/** Nguồn duy nhất cho tên và thứ tự lớp duyệt; `screens/qc/shared/qcLayers.ts` dựng thanh lớp từ đây. */
export const FLOOR_LAYERS: readonly { readonly key: FloorLayerKey; readonly label: string; readonly path: (projectId: string, floorId: string) => string }[] = [
  { key: 'walls', label: 'Tường', path: ROUTES.project.walls },
  { key: 'objects', label: 'Cửa và nội thất', path: ROUTES.project.objects },
  { key: 'rooms', label: 'Phòng', path: ROUTES.project.rooms },
  { key: 'dimensions', label: 'Kích thước', path: ROUTES.project.dimensions },
  { key: 'grids', label: 'Trục', path: ROUTES.project.grids },
  { key: 'thickness', label: 'Độ dày tường', path: ROUTES.project.thickness },
];
const FLOOR_LAYER_SEGMENTS: readonly string[] = FLOOR_LAYERS.map((layer) => layer.key);

export interface ProjectLocation {
  readonly projectId: string;
  /** -1 khi đang ở màn của dự án nhưng ngoài sáu bước (ví dụ cài đặt). */
  readonly stepIndex: number;
  /** Tầng đang mở trong bước 3 (`/floors/:floorId/...`), nếu có. */
  readonly floorId?: string;
  /** Chỉ số trong {@link FLOOR_LAYERS} khi đang ở một lớp của tầng; -1 khi không. */
  readonly layerIndex?: number;
}

/** `/projects/p1/floors/f1/layers/walls` → `{ projectId: 'p1', stepIndex: 2, floorId: 'f1', layerIndex: 0 }`; ngoài dự án hoặc 404 → null. */
export function projectLocationOf(pathname: string): ProjectLocation | null {
  const match = /^\/projects\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?(?:\/([^/]+))?/.exec(pathname);
  if (match?.[1] === undefined) return null;
  const projectId = decodeURIComponent(match[1]);
  const segment = match[2] ?? '';
  // Sơ đồ xử lý mở từ nhiều nơi, không phải bước "Xử lý".
  if (segment === 'pipeline' && match[3] === 'graph') return { projectId, stepIndex: -1 };
  const stepIndex = PROJECT_STEPS.findIndex((step) => step.segments.includes(segment));
  if (stepIndex === -1) return OFF_STEP_SEGMENTS.includes(segment) ? { projectId, stepIndex } : null;
  if (segment !== 'floors' || match[3] === undefined) return { projectId, stepIndex };
  const floorId = decodeURIComponent(match[3]);
  const layerIndex = match[4] === 'layers' ? FLOOR_LAYER_SEGMENTS.indexOf(match[5] ?? '') : -1;
  return { projectId, stepIndex, floorId, layerIndex };
}
