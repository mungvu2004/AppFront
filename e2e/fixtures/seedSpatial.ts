/**
 * Bơm `store.spatial` (và `floors`) bằng bộ mẫu chuẩn A14, qua cửa dev.
 *
 * **Hàm này CHẠM VÀO NỘI BỘ DEV.** Nó `import('/src/store/index.ts')` ngay trong
 * trang, nên chỉ sống được trên máy chủ dev của Vite (`scripts/run-playwright.mjs`
 * chạy `vite` dev, CI cũng vậy). Bản dựng production không có đường `/src/...`.
 * Kho dời chỗ thì hàm này vỡ — và nên vỡ ồn ào. Nó là cái nạng của Q1 = A′:
 * đường nạp thật của sản phẩm chưa có, và mỗi màn dùng nó phải kèm một ca mồi
 * KHÔNG bơm (`plan.md` mục 6.1).
 *
 * Quy tắc dùng:
 * 1. Bơm SAU khi đã tới màn: `goto` -> `seedSpatial` -> khẳng định.
 * 2. KHÔNG `Ctrl+Z` trong ca có bơm: lượt bơm tự nó là một bước `zundo`, nên
 *    `Ctrl+Z` thừa hoàn tác chính lượt bơm (đo ở `thickness`).
 * 3. Tên bài phải nói ra rằng nó bơm.
 *
 * Bơm cả `floors`: chỉ `setSpatial` thì `ExportPanel` vẫn rỗng (đo lớp 2); màn đọc
 * `floors` từ `projectSlice`. `versionId` để `null`.
 */
import type { Page } from '@playwright/test';

export async function seedSpatial(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Biến, không chuỗi trần: TypeScript không tìm tệp ở `/src/...` trong Node.
    const load = (path: string): Promise<unknown> => import(/* @vite-ignore */ path);

    const store = (await load('/src/store/index.ts')) as {
      useStore: {
        getState: () => {
          setSpatial: (spatial: unknown, versionId: null) => void;
          setFloors: (floors: unknown) => void;
        };
      };
    };
    const fixture = (await load('/src/domain/spatial/__fixtures__/sampleBuilding.ts')) as {
      createSampleBuilding: () => { levels: unknown };
    };
    const normalize = (await load('/src/domain/spatial/normalize.ts')) as {
      normalizeSpatial: (graph: unknown) => unknown;
    };

    const graph = fixture.createSampleBuilding();
    const state = store.useStore.getState();
    state.setSpatial(normalize.normalizeSpatial(graph), null);
    state.setFloors(graph.levels);
  });
}
