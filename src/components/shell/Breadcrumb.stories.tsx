import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumb } from './Breadcrumb';
import type { BreadcrumbItem } from '../../hooks/useBreadcrumb';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof Breadcrumb> = {
  title: 'shell/Breadcrumb',
  component: Breadcrumb,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Breadcrumb>;

// ── Dữ liệu chuẩn ─────────────────────────────────────────────────────────────

const floorOptions: BreadcrumbItem['options'] = [
  { id: 'floor-0', label: 'Tầng hầm', onClick: () => {} },
  { id: 'floor-1', label: 'Tầng 01',  onClick: () => {} },
  { id: 'floor-2', label: 'Tầng 02',  onClick: () => {} },
  { id: 'floor-3', label: 'Tầng mái', onClick: () => {} },
];

// ── 1. Default (3 cấp) ────────────────────────────────────────────────────────

export const Default: Story = {
  args: {
    items: [
      { id: 'project', label: 'Dự án mẫu', onClick: () => {} },
      { id: 'floor',   label: 'Tầng 01',   onClick: () => {}, options: floorOptions },
      { id: 'layer',   label: 'Lớp tường' },
    ] satisfies BreadcrumbItem[],
  },
  parameters: {
    docs: { description: { story: 'Ba cấp: dự án → tầng (có dropdown) → lớp hiện tại. Cấp cuối không click được.' } },
  },
};

// ── 2. WithDropdown (cấp giữa mở sẵn) ────────────────────────────────────────
// Note: dropdown tự quản lý qua useBreadcrumb; story này render trạng thái ban đầu đóng.

export const WithDropdown: Story = {
  args: {
    items: [
      { id: 'project', label: 'Dự án mẫu', onClick: () => {} },
      { id: 'floor',   label: 'Tầng 01',   onClick: () => {}, options: floorOptions },
      { id: 'layer',   label: 'Lớp kích thước' },
    ] satisfies BreadcrumbItem[],
  },
  parameters: {
    docs: { description: { story: 'Cấp giữa "Tầng 01" có dropdown 4 lựa chọn (Tầng hầm, 01, 02, mái). Click để mở.' } },
  },
};

// ── 3. SingleItem ─────────────────────────────────────────────────────────────

export const SingleItem: Story = {
  args: {
    items: [
      { id: 'project', label: 'Dự án mẫu' },
    ] satisfies BreadcrumbItem[],
  },
  parameters: {
    docs: { description: { story: 'Chỉ một cấp — không có separator, không click được.' } },
  },
};

// ── 4. TwoItems ───────────────────────────────────────────────────────────────

export const TwoItems: Story = {
  args: {
    items: [
      { id: 'project', label: 'Dự án mẫu', onClick: () => {} },
      { id: 'layer',   label: 'Lớp tường' },
    ] satisfies BreadcrumbItem[],
  },
  parameters: {
    docs: { description: { story: 'Hai cấp: dự án clickable + lớp hiện tại (không click).' } },
  },
};
