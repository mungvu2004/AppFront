import { useCallback, useMemo } from 'react';

import { createAppApiClient } from '@/api/appClient';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { useAutosave } from '@/hooks/useAutosave';
import { createChangedFloorsSave, historyEndsOf } from '@/lib/autosave/spatialLayerSave';
import { useStore } from '@/store';

/**
 * Tự lưu của CẢ màn `/3d` (B-V8-60) — không của panel thuộc tính.
 *
 * Panel chỉ dựng khi có vùng chọn, nên một thay đổi lúc không chọn gì (đổi tên phòng ở
 * bảng diện tích) từng không có lượt lưu nào. Engine và mốc so (`createChangedFloorsSave`)
 * dựng một lần, sống suốt màn; nhãn trả về chuyền vào chân panel.
 *
 * Lỗi được ném nguyên (có `cause`), nên tự lưu dừng ở 409/422 và chỉ thử lại khi rớt mạng.
 */
export function useViewer3DSave(): string | null {
  const saveChangedFloors = useMemo(
    () =>
      createChangedFloorsSave(createAppApiClient().spatial, () =>
        historyEndsOf(useStore.temporal.getState()),
      ),
    [],
  );

  const persist = useCallback(
    async (current: NormalizedSpatial | null): Promise<void> => {
      const projectId = useStore.getState().project?.id;

      if (current === null) {
        return;
      }

      if (projectId === undefined || projectId === '') {
        throw new Error('Chưa mở dự án nào nên chưa có nơi để lưu.');
      }

      await saveChangedFloors(current, projectId);
    },
    [saveChangedFloors],
  );

  return useAutosave(persist);
}
