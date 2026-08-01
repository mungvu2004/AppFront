import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { WallThicknessLegend } from './WallThicknessLegend';

const meta: Meta<typeof WallThicknessLegend> = {
  title: 'Canvas / WallThicknessLegend',
  component: WallThicknessLegend,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const Success: StoryObj = {
  name: 'Thành công',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="success" />
    </div>
  ),
};

export const Loading: StoryObj = {
  name: 'Đang tải',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="loading" />
    </div>
  ),
};

export const Empty: StoryObj = {
  name: 'Rỗng',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="empty" />
    </div>
  ),
};

export const Error: StoryObj = {
  name: 'Lỗi',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="error" />
    </div>
  ),
};

export const Collapsed: StoryObj = {
  name: 'Thu gọn',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="collapsed" />
    </div>
  ),
};

export const PartialState: StoryObj = {
  name: 'Một phần (Chỉ có 110, 220)',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="partial" availableLevels={[110, 220]} />
    </div>
  ),
};

export const NoPermission: StoryObj = {
  name: 'Không có quyền',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 400, height: 300 }}>
      <WallThicknessLegend state="no-permission" />
      <div className="absolute top-2 left-2 font-mono text-xs text-text-muted">
        (không hiển thị gì)
      </div>
    </div>
  ),
};
