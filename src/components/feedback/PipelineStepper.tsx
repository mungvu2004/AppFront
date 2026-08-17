/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState, forwardRef } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStepStatus = 'queued' | 'running' | 'done' | 'failed';

export interface PipelineStepData {
  id: string;
  name: string;
  status: PipelineStepStatus;
  progress: number;
  eta_seconds?: number;
  errorCode?: string; // e.g. "SEG-2041"
  errorMessage?: string; // e.g. "Không thể đọc dữ liệu do ảnh quá mờ"
  onRetry?: () => void;
}

export interface PipelineStepperProps {
  steps: PipelineStepData[];
}

// ─── Internal hook ────────────────────────────────────────────────────────────

function usePipelineStep(step: PipelineStepData) {
  const [flash, setFlash] = useState(false);
  const [prevStatus, setPrevStatus] = useState(step.status);

  useEffect(() => {
    if (step.status === 'done' && prevStatus !== 'done') {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 400);
      setPrevStatus(step.status);
      return () => clearTimeout(timer);
    }
    setPrevStatus(step.status);
  }, [step.status, prevStatus]);

  // `from` mounts the bar at rest; progress updates then run from the shown
  // value, and reduced motion cuts straight to the reported figure.
  const { value: tweenedProgress } = useCountUp(step.progress, { from: step.progress });

  return { flash, tweenedProgress };
}

// ─── Pipeline.Step ────────────────────────────────────────────────────────────

export interface PipelineStepProps {
  step: PipelineStepData;
}

const PipelineStep = forwardRef<HTMLDivElement, PipelineStepProps>(
  ({ step }, ref) => {
    const { flash, tweenedProgress } = usePipelineStep(step);

    const formatETA = (seconds?: number) => {
      if (seconds === undefined) return '';
      const m = Math.floor(seconds / 60);
      if (m > 0) return `Còn khoảng ${m} phút`;
      return `Còn khoảng ${seconds} giây`;
    };

    const isDone = step.status === 'done';
    const isRunning = step.status === 'running';
    const isFailed = step.status === 'failed';

    const textColor = isDone ? 'text-state-verified-text' : isFailed ? 'text-state-violation-text' : 'text-text-primary';
    const iconColor = isDone ? 'text-state-verified' : isFailed ? 'text-state-violation' : isRunning ? 'text-accent' : 'text-text-muted';

    return (
      <div
        ref={ref}
        role="listitem"
        aria-label={`${step.name} — ${step.status}`}
        className={cn(
          'relative flex flex-col px-4 py-3 transition-colors duration-260',
          flash ? 'bg-bg-flash' : 'bg-transparent'
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('w-5 h-5 mt-0.5 flex items-center justify-center shrink-0 transition-colors duration-260', iconColor)} aria-hidden="true">
            {isDone ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="w-full h-full animate-step-icon-draw motion-reduce:animate-none"
                style={{ strokeDasharray: 24, strokeDashoffset: 0 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isFailed ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            ) : isRunning ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full animate-spin motion-reduce:animate-none">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            ) : (
              <div className="w-2 h-2 rounded-full bg-current opacity-40" />
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <span className={cn('text-[15px] font-medium leading-tight', textColor)}>{step.name}</span>
              {isRunning && step.eta_seconds !== undefined && (
                <span className="text-[13px] text-text-secondary whitespace-nowrap">
                  {formatETA(step.eta_seconds)}
                </span>
              )}
            </div>
            
            {isFailed && step.errorMessage && (
              <div className="mt-1 flex flex-col gap-2 items-start">
                <p className="text-[14px] text-state-violation-text leading-snug">
                  {step.errorMessage}
                </p>
                {step.errorCode && (
                  <span className="text-[11px] font-mono font-medium text-state-violation uppercase">
                    {step.errorCode}
                  </span>
                )}
                {step.onRetry && (
                  <Button variant="secondary" size="sm" onClick={step.onRetry} className="mt-1 border-state-violation text-state-violation-text hover:bg-state-violation-tint">
                    Thử lại
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {isRunning && (
          <div className="mt-2.5 ml-8 h-[3px] bg-bg-sunken rounded-full overflow-hidden relative" role="progressbar" aria-valuenow={Math.round(tweenedProgress)} aria-valuemin={0} aria-valuemax={100}>
            {/* Base progress */}
            <div
              className="absolute left-0 top-0 h-full bg-accent transition-all duration-260"
              style={{ width: `${Math.max(0, Math.min(100, tweenedProgress))}%` }}
            />
            {/* Sweeping highlight, two ambient beats per pass. */}
            <div
              className="absolute left-0 top-0 h-full bg-white opacity-40 w-1/3 blur-[2px] animate-pipeline-sweep motion-reduce:animate-none"
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
      className={cn('flex flex-col border border-border-default rounded-xl bg-bg-surface overflow-hidden py-2 w-full max-w-md shadow-sm', className)}
      {...props}
    >
      {/* We inject the sweep keyframes directly here for convenience if not in tailwind.config */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pipeline-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}} />
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
