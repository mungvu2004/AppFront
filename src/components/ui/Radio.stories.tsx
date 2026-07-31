import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Radio, RadioGroup } from './Radio';

const meta: Meta = {
  title: 'ui/Radio',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;

function Controlled() {
  const [val, setVal] = useState('110');
  return (
    <RadioGroup value={val} onChange={setVal} aria-label="Độ dày tường">
      <Radio.Item value="110" label="110 mm" />
      <Radio.Item value="220" label="220 mm" />
      <Radio.Item value="330" label="330 mm" />
    </RadioGroup>
  );
}

export const Default: StoryObj = {
  render: () => <Controlled />,
};

export const WithDescription: StoryObj = {
  render: () => (
    <RadioGroup value="220" onChange={() => {}} aria-label="Loại tường">
      <Radio.Item value="110" label="Tường mỏng" description="Dùng cho vách ngăn nội thất" />
      <Radio.Item value="220" label="Tường chịu lực" description="Tường bao ngoài, kết cấu" />
      <Radio.Item value="330" label="Tường dày" description="Khu vực đặc biệt cần cách âm cao" />
    </RadioGroup>
  ),
};

export const Disabled: StoryObj = {
  render: () => (
    <RadioGroup value="220" onChange={() => {}} disabled aria-label="Vô hiệu">
      <Radio.Item value="110" label="110 mm" />
      <Radio.Item value="220" label="220 mm" />
      <Radio.Item value="330" label="330 mm" />
    </RadioGroup>
  ),
};

export const SingleItemReadOnly: StoryObj = {
  render: () => (
    <RadioGroup value="110" onChange={() => {}} aria-label="Chỉ đọc">
      <Radio.Item value="110" label="110 mm" readOnly />
    </RadioGroup>
  ),
};
