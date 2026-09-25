/**
 * Xoá sạch dữ liệu thuộc về người vừa rời đi, giữ lại thứ thuộc về cái máy.
 *
 * Gọi từ `clearUserData` của `configureAuth` (xem `src/routes/sessionSetup.ts`),
 * tức đúng lúc phiên đổi chủ. Nếu không có nó, người đăng nhập sau thấy dự án,
 * bản nháp và vùng chọn của người trước — cùng một thẻ trình duyệt, hai con
 * người khác nhau.
 *
 * ## Danh sách GIỮ, không phải danh sách XOÁ
 *
 * Bảy slice dữ liệu (`project`, `spatial`, `draft`, `selection`, `history`,
 * `pipeline`, `ruleConfig`) về lại giá trị ban đầu; ba slice `view`, `ui`,
 * `tool` ở nguyên. Nhưng các slice ghép **phẳng** vào `RootState`
 * (`src/store/index.ts:54-65`) — không có `state.project.*` để mà xoá cả cụm —
 * nên chỗ này phải làm việc theo từng khoá.
 *
 * Và nó đi theo hướng ngược với trực giác: liệt kê 14 khoá **được giữ**, rồi
 * xoá tất cả những gì còn lại. Lý do là chuyện sẽ xảy ra khi ai đó thêm một
 * khoá vào một slice dự án và quên file này. Với danh sách giữ, khoá mới rơi
 * vào nhánh "xoá" — an toàn. Với danh sách xoá, nó rơi vào nhánh "giữ", và dữ
 * liệu của người cũ ở lại trên màn của người mới — đúng cái lỗi hàm này tồn tại
 * để chặn.
 *
 * Hàm trong state không bị đụng tới: chúng là chính cái API của store, và ghi
 * đè một hàm bằng "giá trị ban đầu" của nó là thay một closure đang chạy bằng
 * một closure khác không vì lý do gì.
 */

import { useStore, type RootState } from './index';

/**
 * 14 khoá dữ liệu của ba slice không thuộc về người dùng nào.
 *
 * `view` và `ui` là cách người ta bày cái máy của mình ra (và hai slice này
 * cũng là hai slice duy nhất được `persist` giữ qua lượt tải lại); `tool` là
 * công cụ đang cầm trên tay. Không thứ nào trong đây là dữ liệu của một dự án.
 */
const MACHINE_SCOPED_KEYS: ReadonlySet<string> = new Set([
  // viewSlice
  'zoom',
  'viewCenter',
  'viewMode',
  'hiddenLayers',
  'colorMode',
  // uiSlice
  'theme',
  'leftPanelOpen',
  'rightPanelOpen',
  'leftPanelWidthPx',
  'rightPanelWidthPx',
  'openDialog',
  // toolSlice
  'activeTool',
  'toolOptions',
  'toolInteracting',
]);

/** Đặt lại mọi dữ liệu theo người, rồi xoá lịch sử hoàn tác đi cùng nó. */
export function resetUserScopedState(): void {
  const initial = useStore.getInitialState();
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(initial)) {
    if (typeof value === 'function' || MACHINE_SCOPED_KEYS.has(key)) {
      continue;
    }

    patch[key] = value;
  }

  useStore.setState(patch as Partial<RootState>);
  // Lịch sử hoàn tác chỉ theo dõi `spatial` (`index.ts` — `partialize`), nên để
  // lại là để người mới hoàn tác ngược về bản vẽ của người cũ.
  useStore.temporal.getState().clear();
}
