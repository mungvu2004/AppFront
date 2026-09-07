/**
 * Đồ thị không gian thành đầu vào dựng hình của R-01.
 *
 * File này tồn tại vì ngân sách gói, không vì kiến trúc. `toBuildFloorInput` và
 * `storeysOf` chỉ phục vụ đúng một việc — dựng cảnh 3D — mà cảnh thì nạp động.
 * Để chúng ở trong hook nghĩa là `domain/spatial` nằm trong bao đóng TĨNH của
 * màn để phục vụ một khối mã tải muộn, và cổng `routeChunk` đo đúng bao đóng ấy.
 * Tách ra đây thì chúng đi cùng chuyến với module cảnh.
 */

import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import { toBuildFloorInput } from '@/domain/spatial/toBuildFloorInput';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import { storeysOf } from '@/screens/viewer/ViewerShell/viewerShellGateway';

const NO_LEVELS: readonly BuildFloorInput[] = Object.freeze([]);

/**
 * Một `BuildFloorInput` cho mỗi tầng dựng được.
 *
 * `toBuildFloorInput` ném khi đồ thị hỏng chỉ mục hoặc mang số đo không hữu hạn.
 * Đó là một mô hình không dựng được, không phải một sự cố kỹ thuật để hiện mã
 * lỗi: nó thành mảng rỗng, tức đúng nhánh "chưa có cảnh" mà hook đã có sẵn.
 */
export function levelsOf(spatial: NormalizedSpatial | null): readonly BuildFloorInput[] {
  if (spatial === null) {
    return NO_LEVELS;
  }

  try {
    const built: BuildFloorInput[] = [];

    for (const storey of storeysOf(spatial)) {
      const input = toBuildFloorInput(spatial, storey.id);

      if (input !== null) {
        built.push(input);
      }
    }

    return built;
  } catch {
    return NO_LEVELS;
  }
}
