/**
 * The wizard's state line and step bar, both read from one
 * {@link CreateProjectGate} (NGUYEN-TAC-BO-CUC §1: one source of state).
 */

import { Check } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

import { STEP_TITLES, type CreateProjectGate } from './createProjectGate';
import { FLOORS_HINT_ID } from './useCreateProjectModal';

export interface WizardStatusProps {
  readonly gate: CreateProjectGate;
  readonly step: 1 | 2 | 3;
}

export function WizardStatus({ gate, step }: WizardStatusProps) {
  return (
    <div className="mb-4 flex flex-col gap-4 border-b border-border-default pb-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] leading-5 text-text-secondary">
        {gate.chip !== null && (
          <Badge variant={gate.chip.variant} noDot>
            {gate.chip.label}
          </Badge>
        )}
        {/* Step 2's "why not yet" line is the button's description (BUG-120). */}
        <span id={step === 2 && !gate.ready ? FLOORS_HINT_ID : undefined}>{gate.sentence}</span>
      </p>
      <ol aria-label="Các bước tạo dự án" className="flex items-center gap-3">
        {STEP_TITLES.map((title, index) => {
          const n = index + 1;
          const isDone = n < step;
          const isCurrent = n === step;
          return (
            <li
              key={title}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn('flex min-w-0 items-center gap-2', index < STEP_TITLES.length - 1 && 'flex-1')}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                  isCurrent ? 'bg-text-primary text-bg-surface' : 'bg-bg-sunken text-text-secondary',
                )}
              >
                {isDone ? <Check size={14} aria-label="xong" /> : n}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-[13px]',
                  isCurrent ? 'font-medium text-text-primary' : 'text-text-secondary',
                )}
              >
                {title}
              </span>
              {index < STEP_TITLES.length - 1 && (
                <span aria-hidden="true" className={cn('h-px flex-1', isDone ? 'bg-text-primary' : 'bg-border-default')} />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
