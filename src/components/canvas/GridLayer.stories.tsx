import type { Meta, StoryObj } from '@storybook/react';
import { GridLayer } from './GridLayer';

const meta: Meta<typeof GridLayer> = {
  title: 'Canvas / GridLayer',
  component: GridLayer,
  parameters: {
    layout: 'centered',
  },
};
export default meta;

export const Default: StoryObj = {
  name: 'Mặc định (zoom 100%)',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 400 }}>
      <GridLayer width={600} height={400} zoom={1} scaleRatioMmPerPx={12} />
    </div>
  ),
};

export const ZoomedOut: StoryObj = {
  name: 'Thu nhỏ (ẩn lưới nhỏ dưới 40%)',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 400 }}>
      <GridLayer width={600} height={400} zoom={0.25} scaleRatioMmPerPx={12} />
    </div>
  ),
};

export const ZoomedIn: StoryObj = {
  name: 'Phóng to',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 400 }}>
      <GridLayer width={600} height={400} zoom={4} scaleRatioMmPerPx={12} />
    </div>
  ),
};

export const Panned: StoryObj = {
  name: 'Đã pan (offset lệch bước lưới)',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 400 }}>
      <GridLayer width={600} height={400} zoom={1} scaleRatioMmPerPx={12} offsetX={37} offsetY={52} />
    </div>
  ),
};

export const HiddenBelowOnePixel: StoryObj = {
  name: 'Ẩn hoàn toàn (bước lưới dưới 1px)',
  render: () => (
    <div className="relative bg-canvas-2d" style={{ width: 600, height: 400 }}>
      <GridLayer width={600} height={400} zoom={1} scaleRatioMmPerPx={2000} />
      <p className="absolute inset-0 flex items-center justify-center text-[12px] text-text-muted select-none">
        không vẽ gì — bước lưới nhỏ hơn 1px, chặn bởi guard trong GridLayer
      </p>
    </div>
  ),
};
