/**
 * `EditorTour` trong bảy trạng thái của bất biến A11.
 *
 * Mọi story dựng {@link EditorTour} — view thuần — chứ không dựng
 * `useEditorTour`: không registry, không dò neo DOM thật, không localStorage.
 * `EditorTour.test.tsx` cố ý KHÔNG nhập lại file này: mỗi file viết tay bộ chữ
 * và bộ bước của riêng nó — đúng khuôn `WelcomeScreen.stories.tsx`.
 *
 * Bảy story, đúng bảy trạng thái, không hơn — bảng ánh xạ ở mục 6 của
 * `CONTRACT.md` nói mỗi trạng thái vẽ cái gì.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { EditorTour } from './EditorTour';
import type { EditorTourProps, TourRect, TourStepId, TourStepView, TourSummaryRow } from './useEditorTour';

const meta = {
  title: 'Screens/System/EditorTour',
  component: EditorTour,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof EditorTour>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const FIXED_RECT: TourRect = { top: 120, left: 32, width: 220, height: 40 };

function step(
  id: TourStepId,
  title: string,
  body: string,
  combo: string | null,
  comboDescription: string | null,
): TourStepView {
  return {
    id,
    title,
    body,
    combo,
    comboDescription,
    anchorRect: FIXED_RECT,
    placement: 'bottom',
  };
}

/* -------------------------------------------------------------------------- */
/* Sáu bước, chữ KHÔNG trùng câu nào của S-06 (WelcomeScreen).                 */
/* -------------------------------------------------------------------------- */

const STEPS: readonly TourStepView[] = [
  step(
    'switchTool',
    'đổi công cụ đang dùng',
    'Bấm một biểu tượng khác trên dải công cụ bên trái để đổi công cụ đang chọn.',
    'W',
    'đổi công cụ đang dùng',
  ),
  step(
    'reviewWall',
    'chọn đoạn tường tiếp theo',
    'Xuống danh sách để xem chi tiết đoạn tường kế tiếp.',
    'J',
    'chọn đoạn tường tiếp theo',
  ),
  step(
    'editThickness',
    'gán độ dày cho đoạn đang chọn',
    'Chọn một mức độ dày có sẵn cho đoạn tường vừa chọn ở panel bên phải.',
    '1',
    'gán độ dày cho đoạn đang chọn',
  ),
  step(
    'undo',
    'hoàn tác thao tác gần nhất',
    'Trả lại trạng thái ngay trước thao tác vừa thực hiện.',
    'Mod+Z',
    'hoàn tác thao tác gần nhất',
  ),
  step('view3d', 'mở khung nhìn không gian', 'Chuyển sang chế độ dựng hình để nhìn toàn bộ khối nhà vừa lên.', null, null),
  step('exportResult', 'lấy tệp mô hình về máy', 'Bấm nút này khi định dạng đã chọn đã sẵn sàng để tải xuống.', null, null),
];

/** Bốn phím thật sự học được — không bịa hai phím không tồn tại (CONTRACT.md mục 5). */
const SUMMARY: readonly TourSummaryRow[] = STEPS.filter(
  (item): item is TourStepView & { readonly combo: string } => item.combo !== null,
).map((item) => ({ id: item.id, label: item.comboDescription ?? item.title, combo: item.combo }));

/** Mọi trường không đổi giữa bảy trạng thái, một chỗ. */
const BASE: EditorTourProps = {
  screenState: 'partial',
  steps: STEPS,
  activeIndex: 1,
  cutout: STEPS[1]?.anchorRect ?? null,
  isCollapsed: false,
  isReducedMotion: false,
  summary: [],
  isSkipChipVisible: false,
  liveMessage: `đang ở bước 2 trên ${String(STEPS.length)}: chọn đoạn tường tiếp theo`,
  onNext: noop,
  onSkip: noop,
  onJump: noop,
  onFinish: noop,
  onReopen: noop,
  onOpenSampleProject: noop,
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: đã xem xong, không hiện gì trừ chip bỏ qua còn lại. */
export const Empty: Story = {
  args: {
    ...BASE,
    screenState: 'empty',
    steps: [],
    activeIndex: -1,
    cutout: null,
    isSkipChipVisible: true,
    liveMessage: '',
  },
};

/** 2 — đang tải: chưa nạp mô hình, mời mở dự án mẫu, không khoét thủng. */
export const Loading: Story = {
  args: { ...BASE, screenState: 'loading', steps: [], activeIndex: -1, cutout: null },
};

/** 3 — một phần: mở lại đúng bước đã dừng, đọc từ cờ "đã xem". */
export const Partial: Story = { args: BASE };

/** 4 — lỗi: bước `view3d` mất neo, biến mất khỏi mảng bước, bộ đếm còn "x / 5". */
export const ErrorState: Story = {
  args: {
    ...BASE,
    screenState: 'error',
    steps: STEPS.filter((item) => item.id !== 'view3d'),
    activeIndex: 0,
    cutout: STEPS[0]?.anchorRect ?? null,
    liveMessage: 'mất một điểm neo — còn 5 bước',
  },
};

/** 5 — thành công: thẻ tổng kết bốn phím thật sự học được, nút chính "bắt đầu làm việc". */
export const Success: Story = {
  args: {
    ...BASE,
    screenState: 'success',
    activeIndex: STEPS.length - 1,
    cutout: null,
    summary: SUMMARY,
  },
};

/** 6 — không có quyền: vai Người xem, mảng bước rút còn đúng ba bước xem. */
export const Forbidden: Story = {
  args: {
    ...BASE,
    screenState: 'forbidden',
    steps: STEPS.filter((item) => item.id === 'reviewWall' || item.id === 'view3d' || item.id === 'exportResult'),
    activeIndex: 0,
    cutout: STEPS[1]?.anchorRect ?? null,
  },
};

/** 7 — thu gọn: dưới 1280 tấm trượt đáy, không khoét thủng. */
export const Collapsed: Story = {
  args: { ...BASE, screenState: 'collapsed', isCollapsed: true, cutout: null },
};
