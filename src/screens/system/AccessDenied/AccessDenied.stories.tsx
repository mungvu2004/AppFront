/**
 * `AccessDenied` trong bảy trạng thái của bất biến A11.
 *
 * Viết song song với view và hook (W1/W2) — cả hai chưa tồn tại lúc file này
 * được viết (xem `accessDeniedModel.ts`, hợp đồng đông cứng của màn). File này
 * giả định `AccessDenied` nhận thẳng một `AccessDeniedVm` làm props, xuất từ
 * `./AccessDenied` — đúng khuôn `NotFound.stories.tsx`.
 *
 * Nếu tên trường lệch một chút khi lớp ghép chạy thật, người ghép sửa ở đây —
 * đây là hợp đồng đoán trước, không phải bản đã chốt.
 *
 * Mọi story dựng thẳng `AccessDenied` (view thuần) qua `createAccessDeniedVm`
 * của `accessDeniedScenarios.ts` — không dựng hook, không gateway, không
 * router thật. `AccessDenied.test.tsx` viết bộ dữ liệu nghiệm thu riêng (qua
 * cùng `accessDeniedScenarios.ts`), không nhập lại từ đây.
 *
 * Bẫy đã trả giá và đã tránh: một export không phải story (một hằng số, một
 * hàm phụ) sẽ làm trắng toàn bộ file này. File này KHÔNG export gì khác ngoài
 * `default` và bảy story bên dưới, nên không cần `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { AccessDenied } from './AccessDenied';
import { createAccessDeniedVm } from './accessDeniedScenarios';

const meta = {
  title: 'Screens/System/AccessDenied',
  component: AccessDenied,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AccessDenied>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái.                                                             */
/* -------------------------------------------------------------------------- */

/** 1 — rỗng: cổng bật nhưng chưa gửi yêu cầu nào. */
export const Empty: Story = { args: createAccessDeniedVm('empty') };

/** 2 — đang tải: đang kiểm tra quyền/chủ dự án. */
export const Loading: Story = { args: createAccessDeniedVm('loading') };

/** 3 — một phần: có một phần thông tin (ví dụ chủ dự án) nhưng chưa đủ. */
export const Partial: Story = { args: createAccessDeniedVm('partial') };

/** 4 — lỗi: không xác minh được quyền, vẫn còn đủ hành động thoát. */
export const ErrorState: Story = { args: createAccessDeniedVm('error') };

/** 5 — thành công: quyền đã được cấp, hiện nút "Vào dự án". */
export const Success: Story = { args: createAccessDeniedVm('success') };

/** 6 — không có quyền: trạng thái mặc định của màn này. */
export const Forbidden: Story = { args: createAccessDeniedVm('forbidden') };

/** 7 — thu gọn: cùng dữ liệu với không có quyền, bố cục thu gọn. */
export const Collapsed: Story = { args: createAccessDeniedVm('collapsed') };
