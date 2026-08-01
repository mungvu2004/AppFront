/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Meta, StoryObj } from '@storybook/react';
import { NumericField } from './NumericField';

const meta: Meta<typeof NumericField> = {
  title: 'ui/NumericField',
  component: NumericField,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [(Story: any) => <div style={{ width: 200 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof NumericField>;

export const Millimeters: Story = {
  args: { value: 220, unit: 'mm', label: 'Độ dày tường', min: 0, max: 999 },
};

export const Meters: Story = {
  args: { value: 3.2, unit: 'm', label: 'Cao độ', min: 0, max: 10, step: 0.1 },
};

export const Area: Story = {
  args: { value: 248.6, unit: 'm²', label: 'Diện tích', min: 0 },
};

export const Degrees: Story = {
  args: { value: 90, unit: '°', label: 'Góc', min: 0, max: 360 },
};

export const WithError: Story = {
  args: { value: -5, unit: 'mm', label: 'Lỗi', min: 0, error: 'Giá trị phải lớn hơn 0' },
};

export const Disabled: Story = {
  args: { value: 220, unit: 'mm', label: 'Vô hiệu', disabled: true },
};

export const ReadOnly: Story = {
  args: { value: 248.6, unit: 'm²', label: 'Chỉ đọc', isReadOnly: true },
};

export const Loading: Story = {
  args: { value: 0, unit: 'mm', label: 'Đang tải', isLoading: true },
};
