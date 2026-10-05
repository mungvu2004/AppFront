import type { ApiClient } from '@/api/client';
import { useFloorLayerAutosave, type FloorLayerSaveBlock } from '@/hooks/useAutosave';

export interface Viewer3DSave {
  /** Nhãn tự lưu của cả màn — chân panel thuộc tính nói nó. */
  label: string | null;
  /** Dải của tầng bị khối đầu tiên (màn không có tầng riêng), câu kèm tên tầng. */
  saveBlock: FloorLayerSaveBlock | null;
}

/**
 * Tự lưu của CẢ màn `/3d` (B-V8-60) — không của panel thuộc tính.
 *
 * Panel chỉ dựng khi có vùng chọn, nên một thay đổi lúc không chọn gì (đổi tên phòng ở
 * bảng diện tích) vẫn phải được lưu. Nay đi qua saver lớp tầng dùng chung của người–dự án
 * (F-04x-1): nó tự thấy mọi tầng bị đổi, giữ revision theo lượt đọc, và dừng ở 409.
 *
 * @param apiClient Chỉ dành cho test — mặc định là client của ứng dụng.
 */
export function useViewer3DSave(projectId: string, apiClient?: Pick<ApiClient, 'spatial'>): Viewer3DSave {
  const { label, saveBlock } = useFloorLayerAutosave({ projectId, ...(apiClient ? { apiClient } : {}) });

  return { label, saveBlock };
}
