import React from 'react';
import { cn } from '../../lib/utils';
import { Button, ButtonProps } from '../ui/Button';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export type InlineAlertLevel = 'verified' | 'attention' | 'violation';

export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  level: InlineAlertLevel;
  title?: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}

export function InlineAlert({
  level,
  title,
  message,
  action,
  className,
  ...props
}: InlineAlertProps) {
  const isVerified = level === 'verified';
  const isAttention = level === 'attention';
  const isViolation = level === 'violation';

  const bgClass = isVerified ? 'bg-state-verified-tint' : isAttention ? 'bg-state-attention-tint' : 'bg-state-violation-tint';
  const borderClass = isVerified ? 'border-state-verified' : isAttention ? 'border-state-attention' : 'border-state-violation';
  const textClass = isVerified ? 'text-state-verified-text' : isAttention ? 'text-state-attention-text' : 'text-state-violation-text';
  const iconColorClass = isVerified ? 'text-state-verified' : isAttention ? 'text-state-attention' : 'text-state-violation';

  const Icon = isVerified ? CheckCircle2 : isAttention ? AlertTriangle : AlertCircle;

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-3 rounded-[8px] border',
        bgClass,
        borderClass,
        className
      )}
      {...props}
    >
      <Icon className={cn('shrink-0 mt-0.5', iconColorClass)} size={18} strokeWidth={2} aria-hidden="true" />
      
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        {title && (
          <h4 className={cn('text-[14px] font-semibold leading-tight', textClass)}>
            {title}
          </h4>
        )}
        <p className={cn('text-[14px] leading-relaxed', textClass, !title && 'mt-[1px]')}>
          {message}
        </p>
      </div>

      {action && (
        <div className="shrink-0 ml-2">
          <Button
            size="sm"
            variant={action.variant || 'secondary'}
            onClick={action.onClick}
            className={cn(
              'h-8 text-[13px]',
              isVerified && 'border-state-verified text-state-verified-text hover:bg-state-verified/10',
              isAttention && 'border-state-attention text-state-attention-text hover:bg-state-attention/10',
              isViolation && 'border-state-violation text-state-violation-text hover:bg-state-violation/10'
            )}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
