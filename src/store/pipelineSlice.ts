import type { StateCreator } from 'zustand';
import type { PipelineStep } from '../types/pipeline';

export interface PipelineSlice {
  steps: PipelineStep[];
  errorId: string | null;
  updateStepProgress: (id: string, progress: number, eta_seconds?: number) => void;
  setStepStatus: (id: string, status: PipelineStep['status']) => void;
  failPipeline: (errorId: string) => void;
}

const INITIAL_STEPS: PipelineStep[] = [
  { id: '1', name: 'Tiền xử lý ảnh', status: 'queued', progress: 0 },
  { id: '2', name: 'Nhận diện tường (SegFormer)', status: 'queued', progress: 0 },
  { id: '3', name: 'Nhận diện cửa và nội thất (YOLOv8)', status: 'queued', progress: 0 },
  { id: '4', name: 'Đọc kích thước (PaddleOCR)', status: 'queued', progress: 0 },
  { id: '5', name: 'Chuẩn hóa độ dày tường', status: 'queued', progress: 0 },
  { id: '6', name: 'Dựng Spatial JSON', status: 'queued', progress: 0 },
];

export const createPipelineSlice: StateCreator<PipelineSlice> = (set) => ({
  steps: INITIAL_STEPS,
  errorId: null,
  updateStepProgress: (id, progress, eta_seconds) => set((state) => ({
    steps: state.steps.map(step => {
      if (step.id !== id) return step;
      const updated = { ...step, progress, status: (progress === 100 ? 'done' : 'running') as 'done' | 'running' };
      if (eta_seconds !== undefined) {
        (updated as { eta_seconds?: number }).eta_seconds = eta_seconds;
      }
      return updated;
    })
  })),
  setStepStatus: (id, status) => set((state) => ({
    steps: state.steps.map(step => step.id === id ? { ...step, status } : step)
  })),
  failPipeline: (errorId) => set((state) => ({
    errorId,
    steps: state.steps.map(step => step.status === 'running' ? { ...step, status: 'failed' } : step)
  })),
});
