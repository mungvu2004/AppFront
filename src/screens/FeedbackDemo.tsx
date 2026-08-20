import React, { useState } from 'react';
import { ToastProvider, useToast } from '../components/feedback/Toast';
import type { ToastMessage } from '../components/feedback/Toast';
import { Skeleton } from '../components/feedback/Skeleton';
import { EmptyState } from '../components/feedback/EmptyState';
import { InlineAlert } from '../components/feedback/InlineAlert';
import type { PipelineStepData } from '../components/feedback/PipelineStepper';
import { PipelineStepper } from '../components/feedback/PipelineStepper';
import { ProgressOverlay } from '../components/feedback/ProgressOverlay';

export type ViewState = 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'unprivileged' | 'collapsed';

function DemoContent() {
  const [viewState, setViewState] = useState<ViewState>('empty');
  const { addToast } = useToast();

  const handleTriggerToast = (state: 'verified' | 'attention' | 'violation', message: string, undoable: boolean = false) => {
    const toastOptions: Omit<ToastMessage, 'id'> = { message, state };
    if (undoable) {
      toastOptions.onUndo = () => addToast({ message: 'Đã hoàn tác thao tác.', state: 'verified' });
    }
    addToast(toastOptions);
  };

  const steps: PipelineStepData[] = [
    { id: '1', name: 'Tiền xử lý ảnh', status: 'done', progress: 100 },
    { id: '2', name: 'Nhận diện tường (SegFormer)', status: 'done', progress: 100 },
    { id: '3', name: 'Nhận diện cửa và nội thất (YOLOv8)', status: 'running', progress: 65, eta_seconds: 120 },
    { id: '4', name: 'Đọc kích thước (PaddleOCR)', status: 'queued', progress: 0 },
    { id: '5', name: 'Chuẩn hoá độ dày tường', status: 'queued', progress: 0 },
    { id: '6', name: 'Dựng Spatial JSON', status: 'queued', progress: 0 },
  ];

  const stepsError: PipelineStepData[] = [
    { id: '1', name: 'Tiền xử lý ảnh', status: 'done', progress: 100 },
    { id: '2', name: 'Nhận diện tường (SegFormer)', status: 'failed', progress: 100, errorCode: 'SEG-2041', errorMessage: 'Lỗi OOM' },
    { id: '3', name: 'Nhận diện cửa và nội thất (YOLOv8)', status: 'queued', progress: 0 },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto h-screen overflow-y-auto">
      <div className="mb-8 flex flex-wrap gap-2">
        {(['empty', 'loading', 'partial', 'error', 'success', 'unprivileged', 'collapsed'] as ViewState[]).map(s => (
          <button
            key={s}
            onClick={() => setViewState(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
              viewState === s ? 'bg-accent text-white' : 'bg-bg-sunken text-text-primary hover:bg-black/5'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {/* Toasts Demo */}
        <div className="flex gap-4">
          <button onClick={() => handleTriggerToast('verified', 'Đã xoá 1 đối tượng.', true)} className="px-4 py-2 bg-state-verified text-white rounded-lg hover:bg-state-verified/90 font-medium">Test Undo Toast</button>
          <button onClick={() => handleTriggerToast('attention', 'Mạng chập chờn, đang thử lại.')} className="px-4 py-2 bg-state-attention text-white rounded-lg hover:bg-state-attention/90 font-medium">Test Warning Toast</button>
          <button onClick={() => handleTriggerToast('violation', 'Không thể kết nối đến máy chủ AI.')} className="px-4 py-2 bg-state-violation text-white rounded-lg hover:bg-state-violation/90 font-medium">Test Error Toast</button>
        </div>

        {/* View States */}
        {viewState === 'empty' && (
          <EmptyState
            icon={<div />}
            title="Chưa có tầng nào"
            description="Tải lên một bản vẽ mặt bằng (.png, .jpg, .pdf, .dwg) để bắt đầu."
            action={{ label: 'Tải lên bản vẽ', onClick: () => {} }}
          />
        )}

        {viewState === 'loading' && (
          <div className="space-y-4">
            <div className="relative w-full h-[400px] bg-bg-sunken rounded-xl overflow-hidden">
              <ProgressOverlay progress={45} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <PipelineStepper steps={steps} />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton preset="canvas" className="h-[200px] flex-1 rounded-xl" />
              <Skeleton preset="property-panel" className="h-[200px] w-64 rounded-xl" />
            </div>
          </div>
        )}

        {viewState === 'partial' && (
          <div className="space-y-4">
            <InlineAlert
              level="attention"
              title="Thiếu kích thước tổng"
              message="Hệ thống chỉ nhận được một phần kích thước. Bạn nên dùng thước để xác nhận chiều dài tường."
              action={{ label: 'Thêm thước đo', onClick: () => {} }}
            />
            <div className="h-64 bg-bg-sunken rounded-xl flex items-center justify-center text-text-muted">Content</div>
          </div>
        )}

        {viewState === 'error' && (
          <div className="space-y-4">
            <InlineAlert
              level="violation"
              title="Lỗi phân tích bản vẽ"
              message="Chất lượng ảnh quá thấp hoặc độ phân giải không đủ để nhận diện tường. Vui lòng tải lên ảnh sắc nét hơn."
              action={{ label: 'Tải ảnh khác', onClick: () => {} }}
            />
            <PipelineStepper steps={stepsError} />
          </div>
        )}

        {viewState === 'success' && (
          <div className="space-y-4">
            <InlineAlert
              level="verified"
              title="Đã xử lý xong"
              message="Mô hình 3D đã sẵn sàng."
            />
            <div className="h-64 bg-bg-sunken rounded-xl flex items-center justify-center text-text-muted">Content</div>
          </div>
        )}

        {viewState === 'unprivileged' && (
          <div className="space-y-4">
            <InlineAlert
              level="attention"
              title="Quyền truy cập hạn chế"
              message="Bạn chỉ có quyền xem dự án này. Các thay đổi sẽ không được lưu."
              action={{ label: 'Yêu cầu quyền sửa', onClick: () => {} }}
            />
          </div>
        )}

        {viewState === 'collapsed' && (
          <div className="w-64 border border-border-default p-4 rounded-xl bg-bg-surface flex items-center justify-between cursor-pointer hover:bg-bg-hover">
            <span className="font-medium text-text-primary">Bảng điều khiển</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        )}
      </div>
    </div>
  );
}

export function FeedbackDemo() {
  return (
    <ToastProvider>
      <DemoContent />
    </ToastProvider>
  );
}
