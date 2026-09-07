/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link ExplodedView} — không container, không hook, không
 * một lời gọi mạng nào. Cùng khuôn `OverlayComparison.stories.tsx`.
 *
 * Dữ liệu của cả bảy story lấy nguyên từ `explodedViewScenarioFor`
 * (`explodedViewScenarios.ts`, đóng băng cùng `explodedViewTypes.ts`) — không
 * bịa một bộ props thứ hai tại chỗ (R-70). `ExplodedView.test.tsx` dùng lại
 * đúng hàm này.
 *
 * Tên bảy export dưới đây là bảy trạng thái của `SEVEN_STATE_LABELS`, viết
 * không dấu vì đó là định danh JS — cùng khuôn `OverlayComparison.stories.tsx`.
 *
 * Không export nào ở đây ngoài bảy story và `default`, nên KHÔNG cần
 * `meta.excludeStories` — bẫy "một export không phải story làm trắng cả file"
 * không áp dụng ở đây vì `explodedViewScenarioFor` sống ở file dữ liệu, không
 * ở file này.
 *
 * `ExplodedView` chưa tồn tại trong worktree này (worker khác đang viết song
 * song); Storybook build của file này sẽ đỏ cho tới khi lớp gộp nối lại — kết
 * quả ĐÚNG của lượt này, không phải lỗi ở đây.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { ExplodedView } from './ExplodedView';
import { explodedViewScenarioFor } from './explodedViewScenarios';

const meta = {
  title: 'Màn hình/Tách tầng',
  component: ExplodedView,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ExplodedView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: explodedViewScenarioFor('empty') };

export const DangTai: Story = { args: explodedViewScenarioFor('loading') };

export const MotPhan: Story = { args: explodedViewScenarioFor('partial') };

export const Loi: Story = { args: explodedViewScenarioFor('error') };

export const ThanhCong: Story = { args: explodedViewScenarioFor('success') };

export const KhongCoQuyen: Story = { args: explodedViewScenarioFor('forbidden') };

export const ThuGon: Story = { args: explodedViewScenarioFor('collapsed') };
