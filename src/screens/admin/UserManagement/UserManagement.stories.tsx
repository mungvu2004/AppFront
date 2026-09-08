/**
 * Bảy trạng thái của {@link UserManagement} (A11 / R-63): rỗng, đang tải, một phần, lỗi,
 * thành công, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args` tĩnh, đúng
 * khuôn `ModelLibrary.stories.tsx` (tên export ASCII/tiếng Anh — mục B/E.11 của CLAUDE.md;
 * nhãn tiếng Việt của từng trạng thái nằm trong chú thích ngay trên mỗi story).
 *
 * ## Dữ liệu nhập từ `userManagementScenarios.ts`, không khai lại ở đây (R-70)
 *
 * Bảy kịch bản và `USER_MANAGEMENT_ACTIONS` (no-op thuần, không `vi.fn()` — Storybook không
 * đóng gói được `vitest`) đến từ file dữ liệu thuần cùng thư mục, cũng được
 * `UserManagement.test.tsx` nhập — một nguồn, không hai bản có thể trôi khỏi nhau.
 *
 * ## Seam của lớp viết song song: đã đóng
 *
 * File này viết trước khi `UserManagement.tsx` tồn tại, nên ở lượt của T8 nó báo lỗi phân
 * giải module — đúng cách `ModelLibrary.stories.tsx` từng ở lớp trước khi `ModelLibrary.tsx`
 * tồn tại. Lớp gộp (T9) đã ghép view thật vào và lời nhập dưới đây phân giải bình thường.
 *
 * **Không export thứ gì khác ngoài `meta` và bảy story** mà không khai qua
 * `meta.excludeStories` — một export không phải story làm Storybook trắng cả file.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { UserManagement } from './UserManagement';
import {
  USER_MANAGEMENT_ACTIONS,
  USER_MANAGEMENT_SCENARIO_COLLAPSED,
  USER_MANAGEMENT_SCENARIO_EMPTY,
  USER_MANAGEMENT_SCENARIO_ERROR,
  USER_MANAGEMENT_SCENARIO_FORBIDDEN,
  USER_MANAGEMENT_SCENARIO_LOADING,
  USER_MANAGEMENT_SCENARIO_PARTIAL,
  USER_MANAGEMENT_SCENARIO_SUCCESS,
} from './userManagementScenarios';

const meta = {
  title: 'Screens/Admin/UserManagement',
  component: UserManagement,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof UserManagement>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1 · rỗng — chỉ một người (chính mình) + câu dạy việc mời đội + nút mời người dùng. */
export const Empty: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_EMPTY },
};

/** 2 · đang tải — tám hàng khung xương. */
export const Loading: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_LOADING },
};

/** 3 · một phần — danh sách + ba lời mời chờ nhận, một cái đã hết hạn. */
export const Partial: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_PARTIAL },
};

/** 4 · lỗi — không tải được danh sách, kèm lời báo hỏng và nút thử lại. */
export const ErrorState: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_ERROR },
};

/** 5 · thành công — bảng đầy đủ, panel chi tiết mở kèm ma trận quyền. */
export const Success: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_SUCCESS },
};

/** 6 · không có quyền — chỉ ma trận quyền, KHÔNG danh sách người, kèm liên kết quay lại. */
export const Forbidden: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_FORBIDDEN },
};

/** 7 · thu gọn — dưới 1024: bảng thành thẻ, panel thành lớp phủ. */
export const Collapsed: Story = {
  args: { actions: USER_MANAGEMENT_ACTIONS, model: USER_MANAGEMENT_SCENARIO_COLLAPSED },
};
