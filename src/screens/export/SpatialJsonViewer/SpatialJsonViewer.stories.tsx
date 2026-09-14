import type { Meta, StoryObj } from '@storybook/react';

import { SpatialJsonViewer } from './SpatialJsonViewer';
import { buildSpatialJsonViewerProps } from './spatialJsonViewerFixtures';

/**
 * S-36 — bảy trạng thái của màn xem Spatial JSON.
 *
 * Mọi story dựng trên bộ mẫu chuẩn `createSampleBuilding()`, nên số ở chân màn
 * ("4 tầng · 48 tường · …") là số thật của bộ ấy chứ không phải số gõ tay.
 *
 * `meta.excludeStories` không cần ở đây: file này **chỉ** xuất story, mọi thứ
 * khác nằm ở `./spatialJsonViewerFixtures`. Đó là cách chắc chắn nhất để không
 * vấp bẫy "một export không phải story làm trắng cả file".
 */
const meta = {
  title: 'Screens/Export/SpatialJsonViewer',
  component: SpatialJsonViewer,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof SpatialJsonViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1 · rỗng — bản vẽ chưa chạy xong pipeline nên chưa có JSON nào. */
export const Empty: Story = { args: buildSpatialJsonViewerProps('empty') };

/** 2 · đang tải — khung xương của cây, chưa hàng nào hiện. */
export const Loading: Story = { args: buildSpatialJsonViewerProps('loading') };

/** 3 · một phần — đã có dữ liệu trên màn và một lượt làm mới đang chạy. */
export const Partial: Story = { args: buildSpatialJsonViewerProps('partial') };

/** 4 · lỗi — đầu ra hỏng; câu lỗi nêu cả mã yêu cầu để tra được. */
export const ErrorState: Story = { args: buildSpatialJsonViewerProps('error') };

/** 5 · thành công — cây, chữ thô, dải kiểm tra hợp lệ và chân màn đủ số. */
export const Success: Story = { args: buildSpatialJsonViewerProps('success') };

/** 6 · không có quyền — không vai nào trên dự án thì không thấy dữ liệu. */
export const Forbidden: Story = { args: buildSpatialJsonViewerProps('forbidden') };

/** 7 · thu gọn — dưới 1024, nửa phải ẩn, cây chiếm hết chiều rộng. */
export const Collapsed: Story = { args: buildSpatialJsonViewerProps('collapsed') };
