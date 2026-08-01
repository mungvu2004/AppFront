import React from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

export interface ProgressOverlayProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  progress: number;
  onBackground?: () => void;
}

export function ProgressOverlay({
  title = 'Đang xử lý...',
  progress,
  onBackground,
  className,
  ...props
}: ProgressOverlayProps) {
  // Use stroke-dasharray to draw the ring
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, progress)) / 100) * circumference;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        'absolute inset-0 z-50 flex flex-col items-center justify-center bg-bg-app/88 backdrop-blur-sm transition-opacity duration-340',
        className
      )}
      {...props}
    >
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        {/* Progress Ring */}
        <div className="relative flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
            {/* Background Ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="4"
              className="stroke-bg-sunken"
            />
            {/* Foreground Ring */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="stroke-accent transition-all duration-340 ease-out motion-reduce:transition-none"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold text-text-primary tabular-nums">
              {Math.round(progress)}<span className="text-sm font-medium text-text-secondary">%</span>
            </span>
          </div>
        </div>

        <h3 className="text-[16px] font-medium text-text-primary text-center">
          {title}
        </h3>

        {onBackground && (
          <Button
            variant="ghost"
            onClick={onBackground}
            className="text-text-secondary hover:text-text-primary"
          >
            Để chạy nền và thông báo cho tôi
          </Button>
        )}
      </div>
    </div>
  );
}
