import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import type { ComponentState } from './DevStateSwitcher';
import { DevStateSwitcher } from './DevStateSwitcher';

/**
 * Công cụ dành riêng cho lập trình viên / QA — KHÔNG xuất hiện trên màn sản
 * phẩm (mục B của CLAUDE.md cấm điều khiển loại này lộ ra ở đó). Nó chỉ được
 * gắn vào màn QA nội bộ `src/screens/system/StateGallery.tsx`, để chuyển qua
 * lại bảy trạng thái chuẩn của bất biến A11 khi kiểm thử thủ công.
 */
const meta: Meta<typeof DevStateSwitcher> = {
  title: 'shell/DevStateSwitcher',
  component: DevStateSwitcher,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Công cụ QA nội bộ, không dùng trên màn sản phẩm. Bảy nút tương ứng bảy trạng thái chuẩn của bất biến A11.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof DevStateSwitcher>;

const noop: (state: ComponentState) => void = () => undefined;

// Bảy trạng thái chuẩn (A11) — mỗi story chọn sẵn một nút đang hoạt động.

export const Empty: Story = {
  name: 'Rỗng',
  args: { currentState: 'empty', onStateChange: noop },
};

export const Loading: Story = {
  name: 'Đang tải',
  args: { currentState: 'loading', onStateChange: noop },
};

export const Partial: Story = {
  name: 'Một phần',
  args: { currentState: 'partial', onStateChange: noop },
};

export const ErrorState: Story = {
  name: 'Lỗi',
  args: { currentState: 'error', onStateChange: noop },
};

export const Success: Story = {
  name: 'Thành công',
  args: { currentState: 'success', onStateChange: noop },
};

export const NoPermission: Story = {
  name: 'Không có quyền',
  args: { currentState: 'unauthorized', onStateChange: noop },
};

export const Collapsed: Story = {
  name: 'Thu gọn',
  args: { currentState: 'collapsed', onStateChange: noop },
};

// Bản tương tác được — click đổi trạng thái thật, dùng để kiểm bàn phím (Tab/Enter).
function InteractiveDemo() {
  const [state, setState] = useState<ComponentState>('empty');
  return <DevStateSwitcher currentState={state} onStateChange={setState} />;
}

export const Interactive: Story = {
  name: 'Tương tác được (đổi trạng thái thật)',
  render: () => <InteractiveDemo />,
};
