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
  { id: 'upload', label: 'Tải bản vẽ', path: ROUTES.project.upload, segments: ['upload', 'quality'] },
  { id: 'pipeline', label: 'Xử lý', path: ROUTES.project.pipeline, segments: ['pipeline'] },
  { id: 'floors', label: 'Kiểm tra tầng', path: ROUTES.project.floors, segments: ['floors'] },
  { id: 'viewer', label: 'Mô hình 3D', path: ROUTES.project.viewer, segments: ['3d'] },
  { id: 'rules', label: 'Quy chuẩn', path: ROUTES.project.rules, segments: ['rules'] },
  { id: 'export', label: 'Xuất', path: ROUTES.project.export, segments: ['export', 'data', 'versions'] },
];

export interface ProjectLocation {
  readonly projectId: string;
  /** -1 khi đang ở màn của dự án nhưng ngoài sáu bước (ví dụ cài đặt). */
  readonly stepIndex: number;
}

/** `/projects/p1/floors/f1/layers/walls` → `{ projectId: 'p1', stepIndex: 2 }`; ngoài dự án → null. */
export function projectLocationOf(pathname: string): ProjectLocation | null {
  const match = /^\/projects\/([^/]+)(?:\/([^/]+))?/.exec(pathname);
  if (match?.[1] === undefined) return null;
  const segment = match[2] ?? '';
  return {
    projectId: decodeURIComponent(match[1]),
    stepIndex: PROJECT_STEPS.findIndex((step) => step.segments.includes(segment)),
  };
}
