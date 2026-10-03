/**
 * Bảy story của `PascalViewer` — một cho mỗi trạng thái của A11 (R-63).
 *
 * Vì sao màn NÀY đáng có đủ bảy, hơn phần lớn màn khác: Pascal — gói ngoài,
 * chạy ở gốc React thứ hai — tự dựng `fallback={null}` khi một node trong
 * cảnh ném lỗi lúc render
 * (`vendor/pascal/packages/viewer/src/components/viewer/render-error.tsx:29-45`).
 * Nhánh lỗi CỦA PASCAL, nếu không có gì chặn trước, ra đúng màn trắng — đúng
 * thất bại duy nhất mà A11 tồn tại để chặn, và `ScreenErrorBoundary` của
 * AppFront không với tới được vì nó không bọc qua gốc React thứ hai
 * (`pascalViewerTypes.ts:9-13`).
 *
 * `PascalViewer` (view thuần, không nhập `@pascal-app/*`) là hàng rào đứng
 * trước cái hố đó: khung nhúng Pascal chỉ có mặt ở nhánh `success`/`partial`,
 * còn `error` luôn có `EmptyState` kèm mã đọc được và nút "thử lại" — không
 * bao giờ là khoảng trắng. Bảy story dưới đây là bằng chứng CHẠY ĐƯỢC cho lời
 * hứa ấy: dựng thẳng view bằng props tay, không WebGL, không gói Pascal,
 * không store — đúng mục D.
 *
 * Số đo và danh sách bị bỏ qua lấy cùng hình dạng dữ liệu với
 * `PascalViewer.test.tsx`, để hai tệp không nói hai chuyện khác nhau: số đo
 * là bộ mẫu chuẩn A14 (4 tầng, 48 tường, 16 ô mở, 14 phòng), và `partial` bỏ
 * qua đúng hai loại A14 có mà Pascal chưa nhận — 4 trục định vị, 34 kích
 * thước.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { PascalViewer } from './PascalViewer';
import {
  PASCAL_VIEWER_CAPTIONS,
  PASCAL_VIEWER_TITLE,
  type PascalViewerState,
  type PascalViewerViewModel,
} from './pascalViewerTypes';

/** Số đo của bộ mẫu chuẩn A14 — chỉ có ở `success` và `partial`. */
const SAMPLE_SUMMARY = {
  levelLabel: '4',
  wallLabel: '48',
  openingLabel: '16',
  roomLabel: '14',
} as const;

/** Hai loại A14 có mà Pascal chưa nhận — chỉ có ở `partial`. */
const SAMPLE_SKIPPED = [
  {
    kind: 'trục định vị',
    countLabel: '4',
    reason: 'Pascal chưa có loại node nào cho trục định vị.',
  },
  {
    kind: 'kích thước',
    countLabel: '34',
    reason: 'Kích thước của bản vẽ chưa được chuyển sang Pascal.',
  },
] as const;

/** Dựng viewModel cho một trạng thái — cùng hình dạng `PascalViewer.test.tsx` dùng. */
function viewModelFor(state: PascalViewerState): PascalViewerViewModel {
  return {
    state,
    title: PASCAL_VIEWER_TITLE,
    caption: PASCAL_VIEWER_CAPTIONS[state],
    summary: state === 'success' || state === 'partial' ? SAMPLE_SUMMARY : null,
    skipped: state === 'partial' ? SAMPLE_SKIPPED : [],
    errorCode: state === 'error' ? 'PASCAL-01' : null,
  };
}

const noop = (): void => {
  /* Story là ảnh tĩnh của một trạng thái; hàm gọi lại có mặt để đủ props. */
};

/** Props của một trạng thái — `canvasRef` không cắm gì thật, view thuần không đọc nó. */
function argsFor(state: PascalViewerState) {
  return {
    viewModel: viewModelFor(state),
    canvasRef: { current: null },
    onRetry: noop,
    onExpand: noop,
  };
}

const meta = {
  title: 'Screens/Viewer/PascalViewer',
  component: PascalViewer,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story): React.JSX.Element => (
      <div className="h-screen w-screen">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PascalViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

/** 1. Rỗng — bản vẽ chưa có tường, phòng hay ô mở nào để dựng. */
export const Rong: Story = { args: argsFor('empty') };

/** 2. Đang tải — khung xương có nhịp thở, chưa có số đo. */
export const DangTai: Story = { args: argsFor('loading') };

/** 3. Một phần — dựng xong nhưng trục định vị và kích thước chưa chuyển sang được. */
export const MotPhan: Story = { args: argsFor('partial') };

/** 4. Lỗi — không nạp được khung dựng hình, mã `PASCAL-01`, có nút thử lại. */
export const Loi: Story = { args: argsFor('error') };

/** 5. Xong — dựng đủ toàn bộ bản vẽ, không gì bị bỏ qua. */
export const Xong: Story = { args: argsFor('success') };

/** 6. Không có quyền — màn xem 3D mới chưa bật cho tài khoản này. */
export const KhongCoQuyen: Story = { args: argsFor('forbidden') };

/** 7. Thu gọn — khung xem không chạy để đỡ tốn máy, có nút mở lại. */
export const ThuGon: Story = { args: argsFor('collapsed') };
