/**
 * Bảy trạng thái của {@link ExportPanel} (A11 / R-63): rỗng, đang tải, một
 * phần, lỗi, xong, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args`
 * tĩnh, đúng khuôn `RuleSettings.stories.tsx` (tên export ASCII, tiếng Anh — mục
 * B/E.11 của CLAUDE.md; nhãn tiếng Việt của từng trạng thái nằm trong chú thích
 * ngay trên mỗi story).
 *
 * Dữ liệu mẫu đến từ `exportPanelFixtures.ts` — bốn tầng thật của
 * `SAMPLE_BUILDING`, số trang PDF thật từ `buildPdfDocument`, mã lỗi thật từ
 * `APP_ERROR_KIND_CONFIG.export` — không viết tay ở đây (R-70).
 * `ExportPanel.test.tsx` dùng đúng bộ dữ liệu này, nên hai file không kể hai câu
 * chuyện khác nhau về cùng một màn.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { buildExportPanelProps, floorsWithOneUnapproved } from './exportPanelFixtures';
import { ExportPanel } from './ExportPanel';
import type { ExportPanelProps } from './types';

const meta = {
  title: 'Screens/Export/ExportPanel',
  component: ExportPanel,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ExportPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Props nền — mọi story đi qua đây, đúng kiểu hợp đồng `ExportPanelProps`. */
const BASE_PROPS: ExportPanelProps = buildExportPanelProps('empty');

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (tên export ASCII — mục B/E.11; nhãn tiếng Việt trong chú     */
/* thích, đúng khuôn RuleSettings.stories.tsx).                                */
/* -------------------------------------------------------------------------- */

/** 1 · rỗng — dự án chưa có tầng nào, chưa có gì để xuất. */
export const Empty: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('empty') },
};

/** 2 · đang tải — chưa biết được tầng nào của dự án. */
export const Loading: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('loading') },
};

/**
 * 3 · một phần — đang xuất giữa chừng: tiến trình THẬT (`stepLabel` +
 * `countLabel`), có nút Huỷ, không thanh tiến độ giả.
 */
export const Partial: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('partial') },
};

/** 4 · lỗi — xuất thất bại; mã lỗi chữ đều, có gợi ý, nút thử lại giữ nguyên thiết lập. */
export const ErrorState: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('error') },
};

/**
 * 5 · xong — bốn định dạng, bốn tầng thật của `SAMPLE_BUILDING` (một tầng cố
 * tình để chưa duyệt, vẫn chọn được), khối "Kiểm tra trước khi xuất" còn vi
 * phạm nhưng không chặn nút "Xuất".
 */
export const Success: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('success', { floors: floorsWithOneUnapproved() }) },
};

/** 6 · không có quyền — `permissionCaption` nói rõ ai được xuất. */
export const Forbidden: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('forbidden') },
};

/** 7 · thu gọn — bốn thẻ định dạng xếp dọc hết chiều rộng. */
export const Collapsed: Story = {
  args: { ...BASE_PROPS, ...buildExportPanelProps('collapsed') },
};

