import type { Meta, StoryObj } from '@storybook/react';

import { ConnectionStates } from './ConnectionStates';
import {
  buildConnectionStatesProps,
  buildQueueFullModel,
  buildSessionExpiredModel,
  NOOP_ACTIONS,
} from './connectionStatesFixtures';

/**
 * S-45 — bảy trạng thái của lớp trạng thái kết nối, cộng hai cảnh nguy hiểm.
 *
 * Trạng thái "rỗng" ở đây dựng ra **không gì cả**, và đó là hành vi đúng: một
 * lớp kết nối luôn nói gì đó là một lớp người dùng học cách không nhìn.
 *
 * `meta.excludeStories` không cần: file này chỉ xuất story, mọi thứ khác nằm ở
 * `./connectionStatesFixtures`.
 */
const meta = {
  title: 'Screens/System/ConnectionStates',
  component: ConnectionStates,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof ConnectionStates>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 1 · rỗng — trực tuyến, không lệnh chờ. Không hiện gì cả. */
export const Empty: Story = { args: buildConnectionStatesProps('empty') };

/** 2 · đang tải — đang kiểm kết nối lần đầu. */
export const Loading: Story = { args: buildConnectionStatesProps('loading') };

/** 3 · một phần — đang phát lại hàng đợi, xong 8/12. */
export const Partial: Story = { args: buildConnectionStatesProps('partial') };

/** 4 · lỗi — không đọc được hàng đợi trên máy này. */
export const ErrorState: Story = { args: buildConnectionStatesProps('error') };

/** 5 · thành công — đã đồng bộ xong; câu này tự ẩn sau bốn giây. */
export const Success: Story = { args: buildConnectionStatesProps('success') };

/** 6 · không có quyền. */
export const Forbidden: Story = { args: buildConnectionStatesProps('forbidden') };

/** 7 · thu gọn — dải rút thành một biểu tượng ở thanh trạng thái. */
export const Collapsed: Story = { args: buildConnectionStatesProps('collapsed') };

/**
 * Phiên hết hạn — tầng thứ ba, và là cảnh DUY NHẤT được dùng tấm giữa màn.
 *
 * Con số trong câu phải đúng: "Đăng nhập lại để lưu 12 thay đổi chờ đồng bộ."
 */
export const SessionExpired: Story = {
  args: { actions: NOOP_ACTIONS, model: buildSessionExpiredModel() },
};

/** Hàng đợi đầy — chạm trần 200 lệnh hoặc 5 MB của T-09, và nói rõ nguy cơ. */
export const QueueFull: Story = {
  args: { actions: NOOP_ACTIONS, model: buildQueueFullModel() },
};
