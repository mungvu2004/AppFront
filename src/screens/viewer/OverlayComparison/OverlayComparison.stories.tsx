/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link OverlayComparison} — không container, không cổng dữ
 * liệu, không một lời gọi mạng nào. Cùng khuôn `ScaleCalibration.stories.tsx`.
 *
 * Dữ liệu của cả bảy story lấy nguyên từ `OVERLAY_COMPARISON_SCENARIOS`
 * (`overlayComparisonScenarios.ts`, đóng băng cùng `types.ts`) — không bịa một
 * bộ props thứ hai tại chỗ (R-70). {@link OverlayComparison.test.tsx} dùng lại
 * đúng {@link scenarioFor} này.
 *
 * Tên bảy export dưới đây là bảy trạng thái của `SEVEN_STATE_LABELS`
 * (`sevenStateScenarios.ts`), viết không dấu vì đó là định danh JS — cùng khuôn
 * `ScaleCalibration.stories.tsx` và `DimensionOcrReview.stories.tsx`.
 *
 * ## BẪY ĐÃ BIẾT — `meta.excludeStories`
 *
 * Một export không phải story trong file `.stories.tsx` làm TRẮNG toàn bộ file.
 * {@link scenarioFor} không phải story nên có tên trong `meta.excludeStories`.
 *
 * ## Ba mảnh con chưa tồn tại trong worktree này
 *
 * `OverlayComparison` import `OverlayComparisonCanvas`, `OverlayComparisonToolbar`,
 * `OverlayComparisonPanel` — ba file đang viết song song trên nhánh khác (xem
 * chú thích đầu `OverlayComparison.tsx`). Storybook build của file này sẽ đỏ
 * cho tới khi Lớp 3 gộp; đó là kết quả ĐÚNG của lượt này, không phải lỗi ở đây.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { OverlayComparison } from './OverlayComparison';
import { OVERLAY_COMPARISON_SCENARIOS } from './overlayComparisonScenarios';
import type { OverlayComparisonActions, OverlayComparisonProps, OverlayComparisonState } from './types';

/** Story không nối dây; mọi hành động là một hàm không làm gì. */
const NO_OP = (): void => undefined;

const ACTIONS: OverlayComparisonActions = {
  selectFloor: NO_OP,
  setCompareMode: NO_OP,
  setScanOpacity: NO_OP,
  setSwipePosition: NO_OP,
  toggleAlignmentLock: NO_OP,
  setToleranceMm: NO_OP,
  selectRegion: NO_OP,
  setViewport: NO_OP,
  confirmMatch: NO_OP,
};

/**
 * Props đầy đủ của một trạng thái.
 *
 * `OverlayComparisonState` là một union đóng, nên bỏ sót một trạng thái là lỗi
 * biên dịch ở đây, và `expectSevenStates` bắt lại lần nữa lúc chạy.
 */
export function scenarioFor(state: OverlayComparisonState): OverlayComparisonProps {
  return { actions: ACTIONS, model: OVERLAY_COMPARISON_SCENARIOS[state] };
}

const meta = {
  title: 'Màn hình/Đối chiếu bản vẽ',
  component: OverlayComparison,
  parameters: { layout: 'fullscreen' },
  excludeStories: ['scenarioFor'],
} satisfies Meta<typeof OverlayComparison>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: scenarioFor('empty') };

export const DangTai: Story = { args: scenarioFor('loading') };

export const MotPhan: Story = { args: scenarioFor('partial') };

export const Loi: Story = { args: scenarioFor('error') };

export const ThanhCong: Story = { args: scenarioFor('success') };

export const KhongCoQuyen: Story = { args: scenarioFor('forbidden') };

export const ThuGon: Story = { args: scenarioFor('collapsed') };
