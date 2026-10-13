/**
 * Trạng thái lỗi đọc lớp của tầng, thay cả màn QC (BUG-326) — view thuần, cùng khuôn
 * hai nhánh thay màn của `ProjectSpatialGate`. Câu chữ và lối ra đến từ
 * `useFloorLayerReadFailure` (`floorLayerReadFailure.ts`).
 */
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';

import type { FloorLayerReadFailure } from './floorLayerReadFailure';

export interface FloorLayerReadFailureScreenProps {
  readonly failure: FloorLayerReadFailure;
}

export function FloorLayerReadFailureScreen({ failure }: FloorLayerReadFailureScreenProps) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-bg-app p-6" role="alert">
      <EmptyState
        action={{ label: failure.actionLabel, onClick: failure.onAction }}
        description={failure.description}
        icon={<AlertCircle />}
        title={failure.title}
      />
    </div>
  );
}
