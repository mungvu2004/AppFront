/**
 * Khối "Việc tiếp" ngay dưới đầu màn (S-19 bản Z): MỘT tầng cần làm nhất, tối đa 3 điều kiện,
 * thanh đo và MỘT nút chính. Dữ liệu đã suy sẵn ở `floorProgress.ts` (`nextTaskOf`).
 */

import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import type { NextTaskVm } from './floorProgress';

const EYEBROW = 'Việc tiếp';
const CONDITIONS_TITLE = 'Để sang Mô hình 3D';

export interface FloorNextTaskProps {
  readonly task: NextTaskVm;
  readonly onAction: (() => void) | undefined;
}

export function FloorNextTask({ task, onAction }: FloorNextTaskProps) {
  const ratio = task.totalCount === 0 ? 0 : task.doneCount / task.totalCount;

  return (
    <section
      aria-label={EYEBROW}
      className="flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl bg-bg-surface px-5 py-4 shadow-panel"
    >
      <div className="min-w-0 flex-1">
        <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">{EYEBROW}</p>
        <h2 className="mt-1 text-heading text-text-primary">{task.title}</h2>
        <p className="mt-1 text-body text-text-secondary">{task.reason}</p>
      </div>

      {task.conditions.length > 0 && (
        <div className="min-w-[200px]">
          <p className="text-[12px] text-text-secondary">{CONDITIONS_TITLE}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-text-primary">
            {task.conditions.map((condition) => (
              <li key={condition}>
                <span aria-hidden="true" className="mr-1.5 text-text-secondary">○</span>
                {condition}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-2">
          <div
            aria-label={task.meterText}
            aria-valuemax={task.totalCount}
            aria-valuemin={0}
            aria-valuenow={task.doneCount}
            className="relative h-1.5 w-24 overflow-hidden rounded-full bg-bg-sunken"
            role="meter"
          >
            <div className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-accent" style={{ scale: `${ratio} 1` }} />
          </div>
          <span className="text-[12px] text-text-secondary">{task.meterText}</span>
        </div>
        {onAction !== undefined && (
          <Button iconAfter={<ArrowRight className="h-4 w-4" />} onClick={onAction} variant="primary">
            {task.actionLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
