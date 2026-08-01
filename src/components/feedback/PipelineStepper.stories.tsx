import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PipelineStepper, PipelineStepData } from './PipelineStepper';

const meta = {
  title: 'Feedback/PipelineStepper',
  component: PipelineStepper,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-8 bg-bg-app flex flex-col gap-4 max-w-lg w-full mx-auto">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PipelineStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockSteps: PipelineStepData[] = [
  { id: '1', name: 'Tiền xử lý ảnh', status: 'done', progress: 100 },
  { id: '2', name: 'Nhận diện tường (SegFormer)', status: 'running', progress: 45, eta_seconds: 120 },
  { id: '3', name: 'Nhận diện cửa và nội thất (YOLOv8)', status: 'queued', progress: 0 },
  { id: '4', name: 'Đọc kích thước (PaddleOCR)', status: 'queued', progress: 0 },
  { id: '5', name: 'Chuẩn hóa độ dày tường', status: 'queued', progress: 0 },
  { id: '6', name: 'Dựng Spatial JSON', status: 'queued', progress: 0 },
];

export const Running: Story = {
  args: {
    steps: mockSteps,
  },
};

const mockStepsError: PipelineStepData[] = [
  { id: '1', name: 'Tiền xử lý ảnh', status: 'done', progress: 100 },
  { id: '2', name: 'Nhận diện tường (SegFormer)', status: 'done', progress: 100 },
  { 
    id: '3', 
    name: 'Nhận diện cửa và nội thất (YOLOv8)', 
    status: 'failed', 
    progress: 0,
    errorCode: 'SEG-2041',
    errorMessage: 'Không thể nhận diện cửa do chất lượng ảnh đầu vào quá mờ. Vui lòng thử lại với ảnh độ phân giải cao hơn.',
    onRetry: () => console.log('Retrying...')
  },
  { id: '4', name: 'Đọc kích thước (PaddleOCR)', status: 'queued', progress: 0 },
  { id: '5', name: 'Chuẩn hóa độ dày tường', status: 'queued', progress: 0 },
  { id: '6', name: 'Dựng Spatial JSON', status: 'queued', progress: 0 },
];

export const Failed: Story = {
  args: {
    steps: mockStepsError,
  },
};

const mockStepsDone: PipelineStepData[] = [
  { id: '1', name: 'Tiền xử lý ảnh', status: 'done', progress: 100 },
  { id: '2', name: 'Nhận diện tường (SegFormer)', status: 'done', progress: 100 },
  { id: '3', name: 'Nhận diện cửa và nội thất (YOLOv8)', status: 'done', progress: 100 },
  { id: '4', name: 'Đọc kích thước (PaddleOCR)', status: 'done', progress: 100 },
  { id: '5', name: 'Chuẩn hóa độ dày tường', status: 'done', progress: 100 },
  { id: '6', name: 'Dựng Spatial JSON', status: 'done', progress: 100 },
];

export const Completed: Story = {
  args: {
    steps: mockStepsDone,
  },
};
