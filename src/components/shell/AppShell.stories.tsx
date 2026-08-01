import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AppShell } from './AppShell';

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof AppShell> = {
  title: 'shell/AppShell',
  component: AppShell,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Vỏ ứng dụng chính — top bar, rail icon, panel trái (280px), canvas, panel phải (344px), status bar. ' +
          'Panel tự động chuyển sang Drawer khi < 1024px và Overlay khi 1024–1279px.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof AppShell>;

// ── Placeholder panels ────────────────────────────────────────────────────────

const LeftContent = () => (
  <div className="h-full w-full bg-bg-surface rounded-[12px] flex flex-col">
    <div className="px-5 h-14 flex items-center border-b border-border-default shrink-0">
      <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Lớp bản vẽ</span>
    </div>
    <div className="flex-1 p-5 flex flex-col gap-3">
      {['Tường ngoài', 'Tường trong', 'Kích thước', 'Cửa / lỗ mở'].map((label, i) => (
        <div key={label} className="flex items-center justify-between py-1.5">
          <span className="text-[13px] text-text-primary">{label}</span>
          <span className="text-[11px] font-mono tabular-nums text-text-muted">
            {[21, 34, 14, 4][i]} obj
          </span>
        </div>
      ))}
    </div>
  </div>
);

const RightContent = () => (
  <div className="h-full w-full bg-bg-surface rounded-[12px] flex flex-col">
    <div className="px-5 h-14 flex items-center border-b border-border-default shrink-0">
      <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider">Thuộc tính</span>
    </div>
    <div className="flex-1 p-5 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {[
          ['Tổng diện tích', '248,60 m²'],
          ['Số phòng', '48'],
          ['Tường ngoài', '21 mm'],
          ['Tường trong', '34 mm'],
          ['Số lớp', '4'],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-[13px] text-text-secondary">{label}</span>
            <span className="text-[13px] font-mono tabular-nums text-text-primary">{value}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ── Shared args ───────────────────────────────────────────────────────────────

const sharedArgs: Partial<React.ComponentProps<typeof AppShell>> = {
  leftPanelContent: <LeftContent />,
  rightPanelContent: <RightContent />,
  cursorX: 124.5,
  cursorY: 89.12,
  scaleRatio: '1:100',
  scaleDensity: '12 mm/px',
  saveText: 'Đã lưu lúc 14:32',
  breadcrumbs: [
    { id: 'project', label: 'Dự án mẫu', onClick: () => {} },
    {
      id: 'floor',
      label: 'Tầng 01',
      onClick: () => {},
      options: [
        { id: 'floor-0', label: 'Tầng hầm', onClick: () => {} },
        { id: 'floor-1', label: 'Tầng 01',  onClick: () => {} },
        { id: 'floor-2', label: 'Tầng 02',  onClick: () => {} },
        { id: 'floor-3', label: 'Tầng mái', onClick: () => {} },
      ],
    },
    { id: 'layer', label: 'Lớp tường' },
  ],
};

// ── 1. Default (1440px) ───────────────────────────────────────────────────────

export const Default: Story = {
  args: sharedArgs,
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: { description: { story: 'Đủ hai panel ở 1440px. Dùng viewport 1920px để xem layout đầy đủ.' } },
  },
};

// ── 2. LeftCollapsed (1440px, panel trái ẩn) ──────────────────────────────────
// useAppShell quản lý state collapsed — story này chỉ minh hoạ layout bằng cách
// bỏ leftPanelContent để panel tự render rỗng với width=0.

export const LeftCollapsed: Story = {
  args: {
    ...sharedArgs,
    leftPanelContent: undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: {
      description: {
        story:
          'Panel trái thu gọn (toggle bằng phím [ hoặc nút header). ' +
          'Trong Storybook: leftPanelContent=undefined để minh hoạ bố cục.',
      },
    },
  },
};

// ── 3. RightCollapsed (1440px, panel phải ẩn) ─────────────────────────────────

export const RightCollapsed: Story = {
  args: {
    ...sharedArgs,
    rightPanelContent: undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: {
      description: {
        story: 'Panel phải thu gọn (toggle bằng phím ] hoặc nút header).',
      },
    },
  },
};

// ── 4. BothCollapsed ──────────────────────────────────────────────────────────

export const BothCollapsed: Story = {
  args: {
    ...sharedArgs,
    leftPanelContent: undefined,
    rightPanelContent: undefined,
  },
  parameters: {
    viewport: { defaultViewport: 'desktop' },
    docs: {
      description: {
        story: 'Cả hai panel thu gọn — canvas chiếm toàn bộ không gian giữa rail icon.',
      },
    },
  },
};
