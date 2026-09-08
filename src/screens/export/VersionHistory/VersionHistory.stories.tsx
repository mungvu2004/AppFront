/**
 * Bảy trạng thái của {@link VersionHistory} (A11 / R-63): rỗng, đang tải, một phần, lỗi,
 * thành công, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args` tĩnh, đúng
 * khuôn `ShareDialog.stories.tsx` (tên export ASCII, tiếng Anh — mục B/E.11 của CLAUDE.md;
 * nhãn tiếng Việt của từng trạng thái nằm trong chú thích ngay trên mỗi story).
 *
 * Dữ liệu mẫu đến từ `versionHistoryFixtures.ts`: câu diff do `formatChange` sinh, mốc thời
 * gian do `lib/format/datetime` sinh, `VersionDiff` do `diffVersions` thật sinh — không viết
 * tay ở đây (R-70).
 *
 * `./VersionHistory` (view) đang được một worker khác viết SONG SONG trên nhánh riêng; tại
 * thời điểm file này được viết nó CHƯA TỒN TẠI trong worktree này. Đây là seam đã biết —
 * Storybook sẽ báo "failed to resolve" cho tới khi lớp gộp ghép view vào, đúng cách
 * `ShareDialog.stories.tsx` từng ở lớp W4 của nó.
 *
 * **Không export thứ gì khác ngoài `meta` và bảy story.** Một export không phải story (một
 * hằng số, một hàm phụ) làm Storybook trắng cả file; nếu về sau cần một hằng ở đây thì khai
 * nó qua `meta.excludeStories`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { buildVersionHistoryProps } from './versionHistoryFixtures';
import { VersionHistory } from './VersionHistory';

const meta = {
  title: 'Screens/Export/VersionHistory',
  component: VersionHistory,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof VersionHistory>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (tên export ASCII — mục B/E.11; nhãn tiếng Việt trong chú     */
/* thích, đúng khuôn ShareDialog.stories.tsx).                                 */
/* -------------------------------------------------------------------------- */

/** 1 · rỗng — chỉ có một phiên bản; vùng so sánh dạy một câu, chưa có gì để so. */
export const Empty: Story = {
  args: buildVersionHistoryProps('empty'),
};

/** 2 · đang tải — chưa có phiên bản nào hiện; vùng so sánh đang tính lại. */
export const Loading: Story = {
  args: buildVersionHistoryProps('loading'),
};

/** 3 · một phần — mới tải được hai trong bốn phiên bản; cặp so sánh đang tính lại. */
export const Partial: Story = {
  args: buildVersionHistoryProps('partial'),
};

/** 4 · lỗi — không tải được lịch sử phiên bản, kèm lời báo hỏng. */
export const ErrorState: Story = {
  args: buildVersionHistoryProps('error'),
};

/**
 * 5 · thành công — bốn phiên bản, một bản đã dọn theo chính sách lưu giữ (`isMetadataOnly`),
 * cặp so sánh v13→v14 với đủ ba tông màu (thêm/xoá/đổi), tab "trực quan" nói rõ đây là mô
 * hình HIỆN TẠI.
 */
export const Success: Story = {
  args: buildVersionHistoryProps('success'),
};

/** 6 · không có quyền — so sánh vẫn xem được, nút phục hồi rời khỏi DOM kèm lý do. */
export const Forbidden: Story = {
  args: buildVersionHistoryProps('forbidden'),
};

/** 7 · thu gọn — dưới 1024: danh sách phiên bản thành `Select`, vùng so sánh xếp dọc. */
export const Collapsed: Story = {
  args: buildVersionHistoryProps('collapsed'),
};
