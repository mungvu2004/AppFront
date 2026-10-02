/**
 * Bơm `store.spatial` bằng bộ mẫu RIÊNG của từng màn QC-a, qua cửa dev.
 *
 * **Hàm này CHẠM VÀO NỘI BỘ DEV** — cùng cái nạng của `e2e/fixtures/seedSpatial.ts`
 * (Q1 = A′, `plan.md` mục 6.1), đọc docblock ở đó trước. Khác một chỗ: bộ mẫu chung
 * `createSampleBuilding()` không dùng được cho bốn màn này (plan.md V6 mục 0, F5 — ở
 * kích thước nó in cảnh báo "hai con có cùng key" và nút duyệt không đổi `reviewed`),
 * nên mỗi màn nạp đúng bộ mẫu mà story và bài đơn vị của chính nó dùng.
 *
 * Fixture dùng chung là của điều phối viên (hợp đồng chung mục 3), nên trình trợ giúp
 * này sống trong thư mục nhóm.
 *
 * Ba ràng buộc của mọi ca có bơm: tên bài nói ra rằng nó bơm · `goto` rồi mới bơm ·
 * không `Ctrl+Z` thừa (lượt bơm là một bước `zundo`).
 *
 * B-V6-01: ngày sản phẩm có đường nạp thật, ca mồi của từng màn đỏ — khi ấy xoá tệp này.
 */
import type { Page } from '@playwright/test';

export type QcScreen = 'walls' | 'objects' | 'dimensions' | 'grids';

/**
 * Mã tầng cho URL. Tường và trục lọc theo `levelId` của URL, nên phải là mã `Level`
 * của đồ thị bơm vào — `L1` cho ra "rỗng GIẢ" (plan.md V6 mục 0, bẫy tầng F2).
 * Đối tượng và kích thước không lọc theo tầng.
 */
export const QC_FLOOR: Readonly<Record<QcScreen, string>> = {
  walls: 'L-000001LVL0',
  objects: 'L1',
  dimensions: 'L1',
  grids: 'L-AXISFLOOR1',
};

export const QC_PROJECT = 'project-1';

export async function seedQc(page: Page, screen: QcScreen): Promise<void> {
  await page.evaluate(async (which) => {
    // Biến, không chuỗi trần: TypeScript không tìm tệp ở `/src/...` trong Node.
    const load = (path: string): Promise<Record<string, unknown>> =>
      import(/* @vite-ignore */ path) as Promise<Record<string, unknown>>;

    const graphOf = async (): Promise<unknown> => {
      switch (which) {
        case 'walls':
          return (await load('/src/screens/qc/WallLayerReview/wallLayerReviewFixture.ts'))
            .WALL_LAYER_FIXTURE_NORMALIZED;
        case 'objects':
          return (await load('/src/screens/qc/ObjectLayerReview/objectLayerReviewGateway.ts'))
            .OBJECT_LAYER_SAMPLE_GRAPH;
        case 'dimensions':
          return (await load('/src/screens/qc/DimensionOcrReview/dimensionOcrReviewGateway.ts'))
            .DIMENSION_OCR_SAMPLE_GRAPH;
        case 'grids':
          return (
            (await load('/src/screens/qc/AxisGridManager/axisGridManagerGateway.ts'))
              .createAxisGridSampleGraph as () => unknown
          )();
      }
    };

    const graph = await graphOf();
    const store = (await load('/src/store/index.ts')).useStore as {
      getState: () => { setSpatial: (spatial: unknown, versionId: null) => void };
    };
    store.getState().setSpatial(graph, null);
  }, screen);
}
