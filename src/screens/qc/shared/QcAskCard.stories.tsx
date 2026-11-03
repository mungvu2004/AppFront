import type { Meta, StoryObj } from '@storybook/react';

import { QcAskCard } from './QcAskCard';
import { QcInspectorEmpty, QcInspectorSection } from './QcInspectorSection';

const meta: Meta<typeof QcAskCard> = {
  title: 'QC / L23 / QcAskCard',
  component: QcAskCard,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="h-[640px] overflow-hidden rounded-xl" style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

const Body = () => (
  <>
    <QcInspectorSection title="Kích thước">
      <p className="flex items-center">Dài 56 mm · Dày 220 mm</p>
    </QcInspectorSection>
    <QcInspectorSection title="Độ tin cậy">
      <p className="flex items-center">Thấp: ngắn hơn bề dày tường</p>
    </QcInspectorSection>
    <QcInspectorSection collapsible defaultOpen={false} title="Thông số nâng cao">
      <p className="flex items-center">Vật liệu · Chiều cao</p>
    </QcInspectorSection>
  </>
);
const Display = () => (
  <button className="h-8 rounded-md px-2 text-body-sm text-text-secondary hover:bg-bg-hover" type="button">
    Hiển thị
  </button>
);
const Footer = () => (
  <div className="flex gap-2">
    <button className="h-8 flex-1 rounded-md bg-accent text-body-sm font-medium text-white" type="button">Duyệt (A)</button>
    <button className="h-8 rounded-md px-3 text-body-sm text-text-secondary hover:bg-bg-hover" type="button">Để sau (S)</button>
  </div>
);

export const Default: StoryObj<typeof QcAskCard> = {
  name: 'Mặc định',
  render: () => (
    <QcAskCard
      badge={<span className="rounded-md bg-state-attention-tint px-1.5 py-0.5 text-caption font-medium text-state-attention-text">Cần xem</span>}
      code="#W-004"
      display={<Display />}
      eyebrow="Đoạn 3 trong 12 cần xem"
      footer={<Footer />}
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

export const ChuaChon: StoryObj<typeof QcAskCard> = {
  name: 'Chưa chọn gì (Tầng này)',
  render: () => (
    <QcInspectorEmpty display={<Display />} hint="Chọn một đoạn tường trên bản vẽ hoặc trong danh sách để duyệt." title="Tầng này">
      <QcInspectorSection title="Chú giải">
        <p className="flex items-center">Cần xem · 12</p>
        <p className="flex items-center">Đã duyệt · 30</p>
      </QcInspectorSection>
    </QcInspectorEmpty>
  ),
};
