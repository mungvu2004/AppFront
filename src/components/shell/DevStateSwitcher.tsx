import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export type ComponentState = 'empty' | 'loading' | 'partial' | 'error' | 'success' | 'unauthorized' | 'collapsed';

export interface DevStateSwitcherProps extends React.HTMLAttributes<HTMLDivElement> {
  currentState: ComponentState;
  onStateChange: (state: ComponentState) => void;
}

export function DevStateSwitcher({
  currentState,
  onStateChange,
  className,
  ...props
}: DevStateSwitcherProps) {
  const states: { value: ComponentState; label: string }[] = [
    { value: 'empty', label: 'Rỗng (Empty)' },
    { value: 'loading', label: 'Đang tải (Loading)' },
    { value: 'partial', label: 'Một phần (Partial)' },
    { value: 'error', label: 'Lỗi (Error)' },
    { value: 'success', label: 'Thành công (Success)' },
    { value: 'unauthorized', label: 'Không có quyền (Unauthorized)' },
    { value: 'collapsed', label: 'Thu gọn (Collapsed)' },
  ];

  return (
    <div
      className={cn('flex flex-col gap-2 p-4 bg-bg-surface border border-state-attention rounded-xl shadow-lg', className)}
      {...props}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[13px] font-bold text-state-attention uppercase tracking-wide">
          Dev Tools: State Switcher
        </h3>
        <span className="text-[11px] font-mono bg-state-attention-tint text-state-attention-text px-2 py-0.5 rounded-full">
          QA USE ONLY
        </span>
      </div>
      <p className="text-[12px] text-text-secondary mb-2">
        Điều khiển trạng thái của các component bên dưới để test 7 trạng thái chuẩn.
      </p>
      <div className="flex flex-wrap gap-2">
        {states.map((state) => (
          <Button
            key={state.value}
            size="sm"
            variant={currentState === state.value ? 'primary' : 'secondary'}
            onClick={() => onStateChange(state.value)}
            className="text-[12px]"
          >
            {state.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
