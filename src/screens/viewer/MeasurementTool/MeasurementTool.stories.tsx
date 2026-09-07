/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link MeasurementTool} — không container, không hook,
 * không một lời gọi mạng nào. Cùng khuôn `ExplodedView.stories.tsx`.
 *
 * Dữ liệu của cả bảy story lấy nguyên từ `measurementToolScenarioFor`
 * (`measurementToolScenarios.ts`, đóng băng cùng `measurementToolTypes.ts`) —
 * không bịa một bộ props thứ hai tại chỗ (R-70).
 *
 * Không export nào ở đây ngoài bảy story và `default`, nên KHÔNG cần
 * `meta.excludeStories` — bẫy "một export không phải story làm trắng cả
 * file" không áp dụng ở đây vì `measurementToolScenarioFor` sống ở file dữ
 * liệu, không ở file này.
 *
 * `MeasurementTool` chưa tồn tại trong worktree này (worker khác đang viết
 * song song); Storybook build của file này sẽ đỏ cho tới khi lớp gộp nối lại
 * — kết quả ĐÚNG của lượt này, không phải lỗi ở đây.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { MeasurementTool } from './MeasurementTool';
import { measurementToolScenarioFor } from './measurementToolScenarios';

const meta = {
  title: 'Màn hình/Đo lường',
  component: MeasurementTool,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MeasurementTool>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: measurementToolScenarioFor('empty') };

export const DangDo: Story = { args: measurementToolScenarioFor('measuring') };

export const MotPhan: Story = { args: measurementToolScenarioFor('partial') };

export const Loi: Story = { args: measurementToolScenarioFor('error') };

export const Xong: Story = { args: measurementToolScenarioFor('ready') };

export const KhongCoQuyen: Story = { args: measurementToolScenarioFor('forbidden') };

export const ThuGon: Story = { args: measurementToolScenarioFor('collapsed') };
