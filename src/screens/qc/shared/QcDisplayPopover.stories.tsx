import type { Meta, StoryObj } from '@storybook/react';
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
