/**
 * Bơm `store.spatial` bằng bộ mẫu RIÊNG của từng màn QC-b, qua cửa dev.
 *
 * **Hàm này CHẠM VÀO NỘI BỘ DEV** — cùng cái nạng của `e2e/fixtures/seedSpatial.ts`
 * (Q1 = A′, `plan.md` mục 6.1), đọc docblock ở đó trước. Khác một chỗ: mỗi màn nạp
 * đúng bộ mẫu mà story và bài đơn vị của chính nó dùng, không `createSampleBuilding()`
 * — ba màn này có bộ mẫu riêng (14 phòng / 48 đoạn tường / 4 tầng), và mọi con số
 * bài khẳng định là số của bộ ấy.
 *
 * Fixture dùng chung là của điều phối viên (hợp đồng chung mục 3), nên trình trợ giúp
 * này sống trong thư mục nhóm — cùng khuôn `e2e/v6/seedQc.ts` của nhóm QC-a.
 *
 * Hai ràng buộc của mọi ca có bơm: tên bài nói ra rằng nó bơm · `goto` rồi mới bơm.
 * (Ràng buộc cũ "không `Ctrl+Z` thừa" hết lý do từ B-V7-04: lượt nạp không còn là một
 * bước `zundo`.)
 *
 * B-V6-01 phần V7 đã sửa — ba màn có đường nạp thật, và các ca mồi đã thành bài khẳng định
 * đường ấy. Tệp này còn sống cho những ca đếm trên bộ mẫu RIÊNG (14 phòng có ba phòng chưa
 * đặt tên, tường lệch chuẩn, bốn tầng) mà N16 của bộ mẫu dev không có, và vì màn tầng chưa
 * hiện được tầng nào của bộ mẫu dev (B-V7-21).
 */
import type { Page } from '@playwright/test';

export type QcbScreen = 'rooms' | 'floors' | 'thickness';

export const QCB_PROJECT = 'project-1';

/**
 * Mã tầng cho URL. Phòng và độ dày lọc theo `levelId` của URL, nên phải là mã `Level`
 * của đồ thị bơm vào — `L1` cho ra "rỗng GIẢ" (plan.md V6 mục 0, bẫy tầng F2); tự lưu
 * cũng chỉ ghi khi đồ thị có tầng của URL (`createFloorLayerSave`).
 * `floors` không có `:floorId`.
 */
export const QCB_FLOOR = {
  rooms: 'L-000001LVL0',
  thickness: 'L-000001TFL1',
} as const;

export async function seedQcb(page: Page, screen: QcbScreen): Promise<void> {
  await page.evaluate(async (which) => {
    // Biến, không chuỗi trần: TypeScript không tìm tệp ở `/src/...` trong Node.
    const load = (path: string): Promise<Record<string, unknown>> =>
      import(/* @vite-ignore */ path) as Promise<Record<string, unknown>>;

    const graphOf = async (): Promise<unknown> => {
      switch (which) {
        case 'rooms': {
          // Đúng đường `RoomLabelReview.stories.tsx` dựng đồ thị: bộ mẫu chủ ý không kèm tường.
          const fixture = await load('/src/screens/qc/RoomLabelReview/roomLabelFixture.ts');
          const { normalizeSpatial } = (await load('/src/domain/spatial/normalize.ts')) as {
            normalizeSpatial: (graph: unknown) => unknown;
          };
          return normalizeSpatial({
            building: fixture.ROOM_LABEL_FIXTURE_BUILDING,
            levels: [fixture.ROOM_LABEL_FIXTURE_LEVEL],
            walls: [],
            openings: [],
            furniture: [],
            rooms: [...(fixture.ROOM_LABEL_FIXTURE_ROOMS as unknown[])],
            axes: [],
            dimensions: [],
            notes: [],
          });
        }
        case 'floors':
          return (
            (await load('/src/screens/qc/FloorManager/floorManagerGateway.ts'))
              .createFloorManagerSampleGraph as () => unknown
          )();
        case 'thickness':
          return (
            await load('/src/screens/qc/ThicknessStandardization/thicknessStandardizationGateway.ts')
          ).THICKNESS_FIXTURE_GRAPH;
      }
    };

    const graph = await graphOf();
    const store = (await load('/src/store/index.ts')).useStore as {
      getState: () => {
        setSpatial: (
          spatial: unknown,
          versionId: null,
          source: { projectId: string; floorRevisions: Record<string, number> },
        ) => void;
      };
    };
    /* Dự án của URL và revision 0 mỗi tầng: thiếu `source` thì bộ lưu lớp không lưu. */
    const projectId = /\/(?:projects|du-an)\/([^/]+)/.exec(location.pathname)?.[1] ?? 'project-1';
    const levelIds = (graph as { byKind: { level: readonly string[] } }).byKind.level;
    const floorRevisions = Object.fromEntries(levelIds.map((id) => [id, 0]));
    store.getState().setSpatial(graph, null, { floorRevisions, projectId });
  }, screen);
}
