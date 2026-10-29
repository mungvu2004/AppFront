import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { QcViewLayer } from './QcViewLayer';
import { setQcViewMode, type QcPin } from './qcViewMode';

const meta: Meta<typeof QcViewLayer> = {
  title: 'QC / L23 / QcViewLayer',
  component: QcViewLayer,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="relative overflow-hidden bg-canvas-2d" style={{ width: 900, height: 600 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

const PINS: readonly QcPin[] = [
  { id: 'W-004', x: 180, y: 140 },
  { id: 'W-007', x: 420, y: 120 },
  { id: 'W-011', x: 700, y: 210 },
  { id: 'W-015', x: 300, y: 420 },
  { id: 'W-020', x: 620, y: 480 },
];

function Picker({ focus }: { readonly focus: { x: number; y: number; width: number; height: number } | null }) {
  const [selectedId, setSelectedId] = useState<string | null>('W-004');
  return <QcViewLayer focus={focus} onPick={setSelectedId} pins={PINS} selectedId={selectedId} />;
}

export const TungViec: StoryObj<typeof QcViewLayer> = {
  name: 'Từng việc (phủ mờ quanh mục)',
  render: () => {
    setQcViewMode('task');
    return <Picker focus={{ x: 360, y: 240, width: 180, height: 40 }} />;
  },
};

export const TongThe: StoryObj<typeof QcViewLayer> = {
  name: 'Tổng thể (5 ghim số)',
  render: () => {
    setQcViewMode('overview');
    return <Picker focus={null} />;
  },
};
