import type { Meta, StoryObj } from '@storybook/react';
import { ListFilter } from 'lucide-react';
import { useState } from 'react';

import { QcDisplayPopover } from './QcDisplayPopover';

const meta: Meta<typeof QcDisplayPopover> = {
  title: 'QC / L23 / QcDisplayPopover',
  component: QcDisplayPopover,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

function Stateful() {
  const [shown, setShown] = useState<Record<string, boolean>>({
    background: true,
    walls: true,
    openings: true,
    furniture: false,
    rooms: true,
  });
  const toggle = (key: string, label: string) => ({
    key,
    label,
    checked: shown[key] ?? false,
    onToggle: () => setShown((prev) => ({ ...prev, [key]: !(prev[key] ?? false) })),
  });
  return (
    <div className="relative bg-canvas-2d p-6" style={{ width: 600, height: 400 }}>
      <div className="absolute right-3 top-3">
        <QcDisplayPopover
          groups={[
            { title: 'Nền', items: [toggle('background', 'Ảnh bản vẽ gốc')] },
            {
              title: 'Lớp đã duyệt',
              items: [toggle('walls', 'Tường'), toggle('openings', 'Cửa'), toggle('furniture', 'Nội thất'), toggle('rooms', 'Phòng')],
            },
          ]}
        />
      </div>
    </div>
  );
}

export const Default: StoryObj<typeof QcDisplayPopover> = {
  name: 'Hai nhóm công tắc',
  render: () => <Stateful />,
};

function FilterStateful() {
  const [on, setOn] = useState<Record<string, boolean>>({ unreviewed: true, low: false });
  const toggle = (key: string, label: string) => ({ key, label, checked: on[key] ?? false, onToggle: () => setOn((prev) => ({ ...prev, [key]: !(prev[key] ?? false) })) });
  return (
    <QcDisplayPopover
      groups={[{ title: 'Lọc danh sách', items: [toggle('unreviewed', 'Chỉ hiện chưa duyệt'), toggle('low', 'Chỉ hiện chỗ máy chưa chắc')] }]}
      icon={<ListFilter aria-hidden="true" className="h-4 w-4" />}
      label="Lọc"
      popoverLabel="Lọc danh sách"
      showActiveCount
      variant="flat"
    />
  );
}

export const Filter: StoryObj<typeof QcDisplayPopover> = {
  name: 'Nút Lọc phẳng của cột việc (đếm bộ lọc đang bật)',
  render: () => <FilterStateful />,
};
