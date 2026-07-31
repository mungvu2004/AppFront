import type { Meta, StoryObj } from '@storybook/react';
import { FieldRow } from './FieldRow';
import { Input } from './Input';
import { NumericField } from './NumericField';

const meta: Meta<typeof FieldRow> = {
  title: 'ui/FieldRow',
  component: FieldRow,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  decorators: [
    (Story: any) => (
      <div style={{ width: 360, background: 'var(--bg-surface)', borderRadius: 8, overflow: 'hidden' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FieldRow>;

export const Default: Story = {
  args: {
    label: 'Độ dày tường',
    children: <NumericField value={220} unit="mm" />,
  },
};

export const WithInput: Story = {
  args: {
    label: 'Tên phòng',
    children: <Input value="Phòng khách" />,
  },
};

export const Mixed: Story = {
  args: { label: 'Độ dày tường', isMixed: true },
};

export const Loading: Story = {
  args: { label: 'Cao độ', isLoading: true },
};

export const ReadOnly: Story = {
  args: {
    label: 'Diện tích',
    isReadOnly: true,
    children: <span className="flex h-[36px] items-center text-[14px] text-text-primary">248,60 m²</span>,
  },
};

export const Flash: Story = {
  args: {
    label: 'Độ dày tường',
    flash: true,
    children: <NumericField value={220} unit="mm" />,
  },
};

export const Collapsed: Story = {
  args: { label: 'Ẩn đi', collapsed: true, children: null },
};

export const Stacked: Story = {
  render: () => (
    <div>
      <FieldRow label="Độ dày tường">
        <NumericField value={220} unit="mm" />
      </FieldRow>
      <FieldRow label="Cao độ">
        <NumericField value={3.2} unit="m" />
      </FieldRow>
      <FieldRow label="Diện tích" isLast>
        <span className="flex h-[36px] items-center text-[14px] font-mono text-text-primary">248,60 m²</span>
      </FieldRow>
    </div>
  ),
};
