/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Tabs, Tab } from './Tabs';

const meta: Meta = {
  title: 'ui/Tabs',
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 480 }}><Story /></div>],
};
export default meta;

const TABS: Tab[] = [
  { id: 'walls', label: 'Tường', content: <p className="text-[14px] text-text-secondary pt-2">48 tường được phát hiện.</p> },
  { id: 'objects', label: 'Đối tượng', content: <p className="text-[14px] text-text-secondary pt-2">21 đối tượng.</p> },
  { id: 'dims', label: 'Kích thước', content: <p className="text-[14px] text-text-secondary pt-2">34 kích thước.</p> },
];

function Controlled({ tabs = TABS }: { tabs?: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? '');
  return <Tabs tabs={tabs} activeId={active} onChange={setActive} />;
}

export const Default: StoryObj = {
  render: () => <Controlled />,
};

export const WithBadge: StoryObj = {
  render: () => (
    <Controlled
      tabs={[
        { id: 'walls', label: 'Tường', badge: 48, content: <p className="text-[14px] text-text-secondary pt-2">48 tường.</p> },
        { id: 'objects', label: 'Đối tượng', badge: 21, content: <p className="text-[14px] text-text-secondary pt-2">21 đối tượng.</p> },
        { id: 'dims', label: 'Kích thước', badge: 4, content: <p className="text-[14px] text-text-secondary pt-2">Kích thước lỗi.</p> },
      ]}
    />
  ),
};

export const ManyTabs: StoryObj = {
  render: () => (
    <Controlled
      tabs={[
        { id: 't1', label: 'Tầng 1', content: <p className="text-sm text-text-secondary pt-2">Tầng 1</p> },
        { id: 't2', label: 'Tầng 2', content: <p className="text-sm text-text-secondary pt-2">Tầng 2</p> },
        { id: 't3', label: 'Tầng 3', content: <p className="text-sm text-text-secondary pt-2">Tầng 3</p> },
        { id: 'tm', label: 'Tầng lửng', content: <p className="text-sm text-text-secondary pt-2">Lửng</p> },
      ]}
    />
  ),
};

export const Empty: StoryObj = {
  render: () => <Tabs tabs={[]} activeId="" onChange={() => {}} />,
};
