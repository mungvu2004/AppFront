/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState, forwardRef } from 'react';
import { useNumberTween } from '../../hooks/useNumberTween';
import { cn } from '../../lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'error';

export interface PipelineStepData {
  id: string;
  name: string;
  status: PipelineStepStatus;
  progress: number;
  elapsedMs?: number;
  estimatedMs?: number;
  isIndented?: boolean;
}

export interface PipelineStepperProps {
  steps: PipelineStepData[];
}

// ─── Internal hook (unchanged) ────────────────────────────────────────────────

function usePipelineStep(step: PipelineStepData) {
  const [flash, setFlash] = useState(false);
  const [prevStatus, setPrevStatus] = useState(step.status);

  useEffect(() => {
    if (step.status === 'completed' && prevStatus !== 'completed') {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 400);
      setPrevStatus(step.status);
      return () => clearTimeout(timer);
    }
    setPrevStatus(step.status);
  }, [step.status, prevStatus]);

  const tweenedProgress = useNumberTween(step.progress, 260) ?? 0;
  const displayMs = step.status === 'completed' || step.status === 'running' ? step.elapsedMs : step.estimatedMs;
  const tweenedMs = useNumberTween(displayMs, 260);

  return { flash, tweenedProgress, tweenedMs };
}

// ─── Pipeline.Step ────────────────────────────────────────────────────────────

export interface PipelineStepProps {
  step: PipelineStepData;
}

const PipelineStep = forwardRef<HTMLDivElement, PipelineStepProps>(
  ({ step }, ref) => {
    const { flash, tweenedProgress, tweenedMs } = usePipelineStep(step);

    const formatTime = (ms?: number) => {
      if (ms === undefined) return '--:--';
      const totalSec = Math.floor(ms / 1000);
      const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
      const s = (totalSec % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    const isCompleted = step.status === 'completed';
    const isRunning = step.status === 'running';
    const isError = step.status === 'error';

    const textColor = isCompleted ? 'text-state-verified-text' : isError ? 'text-state-violation-text' : 'text-text-primary';
    const iconColor = isCompleted ? 'text-state-verified' : isError ? 'text-state-violation' : isRunning ? 'text-accent' : 'text-text-muted';

    return (
      <div
        ref={ref}
        role="listitem"
        aria-label={`${step.name} — ${step.status}`}
        className={cn(
          'relative flex flex-col px-4 py-3 transition-colors duration-400',
          flash ? 'bg-bg-flash' : 'bg-transparent',
          step.isIndented && 'ml-6 border-l border-border-default'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('w-5 h-5 flex items-center justify-center shrink-0', iconColor)} aria-hidden="true">
            {isCompleted ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-full h-full animate-[empty-icon-draw_260ms_ease-out_forwards]"
                style={{ strokeDasharray: 24, strokeDashoffset: 24 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isError ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : isRunning ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full animate-spin">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-full bg-current opacity-40" />
            )}
          </div>

          <span className={cn('text-[15px] font-medium flex-1', textColor)}>{step.name}</span>
          <span className="font-mono text-sm text-text-secondary w-12 text-right" aria-label={`Thời gian: ${formatTime(tweenedMs)}`}>
            {formatTime(tweenedMs)}
          </span>
        </div>

        {isRunning && (
          <div className="mt-2 ml-8 h-1 bg-bg-sunken rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(tweenedProgress)} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full bg-accent transition-all duration-120"
              style={{ width: `${Math.max(0, Math.min(100, tweenedProgress))}%` }}
            />
          </div>
        )}
      </div>
    );
  }
);
PipelineStep.displayName = 'Pipeline.Step';

// ─── Pipeline.Root ────────────────────────────────────────────────────────────

export interface PipelineRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const PipelineRoot = forwardRef<HTMLDivElement, PipelineRootProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      role="list"
      className={cn('flex flex-col border border-border-default rounded-xl bg-bg-surface overflow-hidden py-2 w-full max-w-md', className)}
      {...props}
    >
      {children}
    </div>
  )
);
PipelineRoot.displayName = 'Pipeline.Root';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Pipeline = {
  Root: PipelineRoot,
  Step: PipelineStep,
};

// ─── Legacy export (backward compat) ──────────────────────────────────────────

export function PipelineStepper({ steps }: PipelineStepperProps) {
  return (
    <PipelineRoot>
      {steps.map((step) => (
        <PipelineStep key={step.id} step={step} />
      ))}
    </PipelineRoot>
  );
}
