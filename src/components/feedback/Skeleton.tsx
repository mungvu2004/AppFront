import React from 'react';
import { cn } from '../../lib/utils';

export type SkeletonPreset = 'table-row' | 'project-card' | 'property-panel' | 'canvas';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  preset: SkeletonPreset;
}

export function Skeleton({ preset, className, ...props }: SkeletonProps) {
  // Tailwind's built-in pulse, overridden in tailwind.config.ts to three ambient
  // beats so it sits on the duration ladder. (A comment here once described a
  // 1400ms shimmer; no such animation was ever wired up.)
  // motion-reduce:animate-none ensures it stops on reduced motion preference
  const baseClass = 'bg-bg-sunken rounded-[8px] animate-pulse motion-reduce:animate-none';

  switch (preset) {
    case 'table-row':
      return (
        <div className={cn('flex items-center gap-4 p-3 w-full', className)} {...props}>
          <div className={cn(baseClass, 'w-8 h-8 rounded-md')} />
          <div className={cn(baseClass, 'h-4 w-1/4')} />
          <div className={cn(baseClass, 'h-4 w-1/4')} />
          <div className={cn(baseClass, 'h-4 w-1/6 ml-auto')} />
        </div>
      );
    case 'project-card':
      return (
        <div className={cn('flex flex-col gap-3 p-4 border border-border-default rounded-[8px] w-full max-w-sm', className)} {...props}>
          <div className={cn(baseClass, 'w-full h-32')} />
          <div className={cn(baseClass, 'h-5 w-3/4')} />
          <div className={cn(baseClass, 'h-4 w-1/2')} />
        </div>
      );
    case 'property-panel':
      return (
        <div className={cn('flex flex-col gap-4 p-4 w-full', className)} {...props}>
          <div className={cn(baseClass, 'h-6 w-1/3 mb-2')} />
          {[1, 2, 3, 4].map((i) => (
            <div key={`property-skeleton-${i}`} className="flex justify-between items-center">
              <div className={cn(baseClass, 'h-4 w-24')} />
              <div className={cn(baseClass, 'h-8 w-32')} />
            </div>
          ))}
        </div>
      );
    case 'canvas':
      return (
        <div className={cn('relative w-full h-full min-h-[400px] bg-bg-app border border-border-default overflow-hidden', className)} {...props}>
          {/* Skeleton overlay simulating grid or loading space */}
          <div className={cn(baseClass, 'absolute inset-0 bg-bg-sunken opacity-50')} />
          <div className={cn(baseClass, 'absolute top-4 left-4 w-48 h-12')} />
          <div className={cn(baseClass, 'absolute top-4 right-4 w-12 h-12')} />
          <div className={cn(baseClass, 'absolute bottom-4 left-4 w-64 h-8')} />
        </div>
      );
    default:
      return null;
  }
}
