import type { Meta, StoryObj } from '@storybook/react';

import { QcAskCard } from './QcAskCard';

const meta: Meta<typeof QcAskCard> = {
  title: 'QC / L23 / QcAskCard',
  component: QcAskCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: 340 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

const Body = () => (
  <div className="flex flex-col gap-2 px-4 py-3 text-body-sm text-text-secondary">
    <p>Dài 56 mm · dày 220 mm</p>
    <p>Đoạn này ngắn hơn bề dày tường, có thể là vết vẽ thừa.</p>
  </div>
);

export const Default: StoryObj<typeof QcAskCard> = {
  name: 'Mặc định',
  render: () => (
    <QcAskCard
      code="#W-004"
      eyebrow="Đoạn 1 trong 7 cần xem"
      onNext={() => console.log('Mục kế tiếp')}
      onPrev={() => console.log('Mục trước')}
      reason="Ngắn hơn bề dày tường"
    >
      <Body />
    </QcAskCard>
  ),
};

export const MucCuoi: StoryObj<typeof QcAskCard> = {
  name: 'Mục cuối (không có kế tiếp)',
  render: () => (
    <QcAskCard
      code="#W-011"
      eyebrow="Đoạn 7 trong 7 cần xem"
      onPrev={() => console.log('Mục trước')}
      reason="Ngắn hơn bề dày tường"
    >
      <Body />
    </QcAskCard>
  ),
};
