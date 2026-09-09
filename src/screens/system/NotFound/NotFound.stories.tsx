/**
 * `NotFound` trong bảy trạng thái của bất biến A11.
 *
 * Viết song song với view và hook (T7) — cả hai chưa tồn tại lúc file này
 * được viết (xem `notFoundModel.ts`, hợp đồng đông cứng của màn). File này giả
 * định `NotFound` nhận thẳng một `NotFoundVm` làm props, xuất từ `./NotFound`
 * — đúng khuôn `NotificationCenter.stories.tsx`.
 *
 * Nếu tên trường lệch một chút khi lớp ghép chạy thật, người ghép sửa ở đây —
 * đây là hợp đồng đoán trước, không phải bản đã chốt.
 *
 * Mọi story dựng thẳng `NotFound` (view thuần) qua `createNotFoundVm` của
 * `notFoundScenarios.ts` — không dựng hook, không gateway, không router thật.
 * `NotFound.test.tsx` viết bộ dữ liệu của riêng nó (qua cùng
 * `notFoundScenarios.ts`), không nhập lại từ đây.
 *
 * Bẫy đã trả giá và đã tránh: một export không phải story (một hằng số, một
 * hàm phụ) sẽ làm trắng toàn bộ file này. File này KHÔNG export gì khác ngoài
 * `default` và bảy story bên dưới, nên không cần `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { NotFound } from './NotFound';
import { createNotFoundVm } from './notFoundScenarios';

const meta = {
  title: 'Screens/System/NotFound',
  component: NotFound,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof NotFound>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: chưa có dự án gần đây nào để gợi ý. */
export const Empty: Story = { args: createNotFoundVm('empty') };

/** 2 — đang tải: chưa lấy xong danh sách dự án gợi ý. */
export const Loading: Story = { args: createNotFoundVm('loading') };

/** 3 — một phần: có gợi ý nhưng chưa đủ bộ RECENT_PROJECT_LIMIT. */
export const Partial: Story = { args: createNotFoundVm('partial') };

/** 4 — lỗi: không lấy được danh sách gợi ý, vẫn đủ hai nút hành động. */
export const ErrorState: Story = { args: createNotFoundVm('error') };

/** 5 — thành công: đủ bộ dự án gợi ý gần đây. */
export const Success: Story = { args: createNotFoundVm('success') };

/** 6 — không có quyền: chưa đăng nhập, nút chính đổi thành "Đăng nhập". */
export const Forbidden: Story = { args: createNotFoundVm('forbidden') };

/** 7 — thu gọn: cùng dữ liệu với thành công, bỏ hình minh hoạ, thu khoảng cách. */
export const Collapsed: Story = { args: createNotFoundVm('collapsed') };
