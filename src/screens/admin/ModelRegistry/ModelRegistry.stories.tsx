/**
 * Bảy trạng thái của {@link ModelRegistry} (A11): rỗng, đang tải, một phần, lỗi, thành công,
 * không có quyền, thu gọn. View thuần với `args` tĩnh từ `modelRegistryScenarios.ts` — cùng
 * nguồn với `ModelRegistry.test.tsx`.
 *
 * Không export gì khác ngoài `meta` và bảy story: một export không phải story làm Storybook
 * trắng cả file.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { ModelRegistry } from './ModelRegistry';
import {
  MODEL_REGISTRY_ACTIONS,
  MODEL_REGISTRY_SCENARIO_COLLAPSED,
  MODEL_REGISTRY_SCENARIO_EMPTY,
  MODEL_REGISTRY_SCENARIO_ERROR,
  MODEL_REGISTRY_SCENARIO_FORBIDDEN,
  MODEL_REGISTRY_SCENARIO_LOADING,
  MODEL_REGISTRY_SCENARIO_PARTIAL,
  MODEL_REGISTRY_SCENARIO_SUCCESS,
} from './modelRegistryScenarios';

const meta = {
  title: 'Screens/Admin/ModelRegistry',
  component: ModelRegistry,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ModelRegistry>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1 · rỗng — họ tường chưa có bản nào, đang dùng đường cổ điển. */
export const Empty: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_EMPTY } };

/** 2 · đang tải — khung xương thẻ "Đang dùng" và tám hàng. */
export const Loading: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_LOADING } };

/** 3 · một phần — họ kích thước: bản gốc chờ đánh giá. */
export const Partial: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_PARTIAL } };

/** 4 · lỗi — máy chủ bận, kèm nút thử lại. */
export const ErrorState: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_ERROR } };

/** 5 · thành công — họ cửa và đồ đạc, chi tiết bản gốc ở cột phải. */
export const Success: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_SUCCESS } };

/** 6 · không có quyền — không gọi mạng. */
export const Forbidden: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_FORBIDDEN } };

/** 7 · thu gọn — dưới 1024: thẻ thay bảng, chi tiết trong `Drawer`. */
export const Collapsed: Story = { args: { actions: MODEL_REGISTRY_ACTIONS, model: MODEL_REGISTRY_SCENARIO_COLLAPSED } };
