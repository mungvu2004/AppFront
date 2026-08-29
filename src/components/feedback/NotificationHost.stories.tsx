/**
 * Ba story của chỗ hiện thông báo.
 *
 * Mỗi story dựng MỘT bus riêng (`createNotificationBus()`), nên hai story không
 * thấy thông báo của nhau và không đụng tới bus của cả phiên. Đó cũng là lý do
 * `NotificationHost` nhận `bus` qua props.
 */

import { useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { createNotificationBus, type NotificationBus } from '@/lib/mutations/notificationBus';
import { Button } from '../ui/Button';

import { NotificationHost } from './NotificationHost';

const meta = {
  title: 'Feedback/NotificationHost',
  component: NotificationHost,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="relative h-[420px] w-full bg-bg-app p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NotificationHost>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Hai câu của màn Xử lý — bản sao khai báo ở `vi.json` khoá `processingScreen.background`. */
const STARTED = {
  title: 'Sẽ báo cho bạn khi xử lý xong',
  description: 'Xử lý vẫn chạy khi bạn rời màn này. Đóng thẻ trình duyệt thì không báo được nữa.',
} as const;

const DONE = {
  title: 'Tầng 1 đã xử lý xong',
  description: 'Mở lại màn xử lý để xem kết quả.',
} as const;

function HostWithBus({ seed }: { seed: (bus: NotificationBus) => void }) {
  const bus = useMemo(() => {
    const created = createNotificationBus();
    seed(created);
    return created;
  }, [seed]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            bus.publish({ type: `nen-bat-dau:${String(Date.now())}`, ...STARTED });
          }}
          size="sm"
          variant="ghost"
        >
          Đẩy thông báo bắt đầu
        </Button>
        <Button
          onClick={() => {
            bus.publish({ type: `nen-xong:${String(Date.now())}`, ...DONE });
          }}
          size="sm"
          variant="ghost"
        >
          Đẩy thông báo xong
        </Button>
      </div>
      <NotificationHost bus={bus} />
    </>
  );
}

/** Chưa có thông báo nào — vùng thông báo vẫn có mặt, và nó rỗng. */
export const Empty: Story = {
  render: () => <HostWithBus seed={() => undefined} />,
};

/** Đúng câu người dùng thấy sau khi bấm "Để chạy nền và thông báo cho tôi". */
export const RunningInBackground: Story = {
  render: () => (
    <HostWithBus
      seed={(bus) => {
        bus.publish({ type: 'nen-bat-dau', ...STARTED });
      }}
    />
  ),
};

/** Lượt xử lý đã xong khi người dùng đang ở màn khác. */
export const Finished: Story = {
  render: () => (
    <HostWithBus
      seed={(bus) => {
        bus.publish({ type: 'nen-bat-dau', ...STARTED });
        bus.publish({ type: 'nen-xong', ...DONE });
      }}
    />
  ),
};
