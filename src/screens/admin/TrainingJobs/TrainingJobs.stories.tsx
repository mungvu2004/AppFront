/**
 * Bảy trạng thái của {@link TrainingJobs} (A11). View thuần với `args` tĩnh từ
 * `trainingJobsScenarios.ts` — cùng nguồn với `TrainingJobs.test.tsx`.
 *
 * Không export gì khác ngoài `meta` và bảy story.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { TrainingJobs } from './TrainingJobs';
import {
  TRAINING_JOBS_ACTIONS,
  TRAINING_JOBS_SCENARIO_COLLAPSED,
  TRAINING_JOBS_SCENARIO_EMPTY,
  TRAINING_JOBS_SCENARIO_ERROR,
  TRAINING_JOBS_SCENARIO_FORBIDDEN,
  TRAINING_JOBS_SCENARIO_LOADING,
  TRAINING_JOBS_SCENARIO_PARTIAL,
  TRAINING_JOBS_SCENARIO_SUCCESS,
} from './trainingJobsScenarios';

const meta = {
  title: 'Screens/Admin/TrainingJobs',
  component: TrainingJobs,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof TrainingJobs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1 · rỗng — chưa có lượt nào; vẫn có tab, bộ lọc và nút "Tạo lượt huấn luyện". */
export const Empty: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_EMPTY } };

/** 2 · đang tải — tám hàng khung xương. */
export const Loading: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_LOADING } };

/** 3 · một phần — một lượt đang chạy, số đo và nhật ký ở cột phải. */
export const Partial: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_PARTIAL } };

/** 4 · lỗi — máy chủ bận, kèm nút thử lại. */
export const ErrorState: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_ERROR } };

/** 5 · thành công — lượt hỏng vì máy chưa cài bộ huấn luyện. */
export const Success: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_SUCCESS } };

/** 6 · không có quyền — không gọi mạng. */
export const Forbidden: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_FORBIDDEN } };

/** 7 · thu gọn — dưới 1024: thẻ thay bảng, chi tiết trong `Drawer`. */
export const Collapsed: Story = { args: { actions: TRAINING_JOBS_ACTIONS, model: TRAINING_JOBS_SCENARIO_COLLAPSED } };
