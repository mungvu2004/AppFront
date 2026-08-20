import React from 'react';
import { cn } from '../../lib/utils';
import type { ButtonProps } from '../ui/Button';
import { Button } from '../ui/Button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: ButtonProps['variant'];
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center p-8 w-full h-full', className)}
      {...props}
    >
      <div
        className="w-12 h-12 rounded-full bg-bg-sunken flex items-center justify-center text-text-muted mb-4"
        aria-hidden="true"
      >
        {/* We assume the icon passed has size 32, strokeWidth 1.5, or we clone it to force it */}
        {React.isValidElement(icon)
          ? React.cloneElement(icon as React.ReactElement, {
              size: 32,
              strokeWidth: 1.5,
              className: cn('text-text-muted', (icon.props as { className?: string }).className),
            })
          : icon}
      </div>
      <h3 className="text-[16px] font-semibold text-text-primary mb-2">{title}</h3>
      <p className="text-[14px] text-text-secondary max-w-sm mb-6 leading-relaxed">
        {description}
      </p>
      {action && (
        <Button variant={action.variant || 'primary'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
