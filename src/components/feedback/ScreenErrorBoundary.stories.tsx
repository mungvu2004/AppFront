import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import { ScreenErrorBoundary } from './ScreenErrorBoundary';
import type { ScreenErrorFallback } from './ScreenErrorBoundary';

/**
 * `ScreenErrorBoundary` không tự vẽ gì (mục D) — nó chỉ bắt lỗi ném ra trong
 * lúc render rồi gọi `renderFallback` mà màn hình truyền vào. Story này dựng
 * một component con cố ý ném lỗi để cho ra được phần dự phòng, và phần dự
 * phòng dùng đúng khuôn đang chạy thật ở `src/App.tsx` (EmptyState + nút
 * "thử lại" khi lỗi thuộc loại đáng thử lại).
 */
const meta: Meta = {
  title: 'feedback/ScreenErrorBoundary',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Ranh giới lỗi của một màn hình. Không có JSX của riêng nó — mọi màu, mọi chữ đều đến từ `renderFallback` mà nơi gọi truyền vào.',
      },
    },
  },
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

/** Con cố ý ném lỗi khi `shouldThrow`, để dựng cảnh màn hình sập. */
function Boom({ shouldThrow, message = '' }: { shouldThrow: boolean; message?: string }) {
  if (shouldThrow) {
    throw new Error(message);
  }

  return <p className="text-[14px] text-text-secondary">Màn hình chạy bình thường.</p>;
}

/** Phần dự phòng — cùng khuôn với `ScreenCrashFallback` trong `src/App.tsx`. */
function fallback({ report, retry }: ScreenErrorFallback) {
  return (
    <div className="h-[280px] border border-border-default rounded-[12px] bg-bg-surface overflow-hidden">
      <EmptyState
        icon={<div className="w-8 h-8 rounded-full bg-state-violation-tint" aria-hidden="true" />}
        title={report.description.title}
        description={report.description.description}
        {...(report.retryable
          ? { action: { label: report.description.primaryButtonLabel, onClick: retry } }
          : {})}
      />
    </div>
  );
}

export const Working: Story = {
  name: 'Bình thường (không có lỗi)',
  render: () => (
    <ScreenErrorBoundary screenId="storybook-demo" renderFallback={fallback}>
      <Boom shouldThrow={false} />
    </ScreenErrorBoundary>
  ),
};

export const CrashedRetryable: Story = {
  name: 'Đã sập — lỗi có thể thử lại (mất mạng)',
  render: () => (
    <ScreenErrorBoundary screenId="storybook-demo" renderFallback={fallback}>
      <Boom shouldThrow message="network: fetch failed" />
    </ScreenErrorBoundary>
  ),
};

export const CrashedNotRetryable: Story = {
  name: 'Đã sập — lỗi không thể thử lại (không có quyền)',
  render: () => (
    <ScreenErrorBoundary screenId="storybook-demo" renderFallback={fallback}>
      <Boom shouldThrow message="forbidden: permission denied" />
    </ScreenErrorBoundary>
  ),
};
