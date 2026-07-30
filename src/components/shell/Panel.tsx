import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

export function Panel({ header, headerAction, children, className, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-[12px] shadow-panel overflow-hidden flex flex-col',
        className
      )}
      {...props}
    >
      {header && (
        <div className="flex items-center justify-between px-5 h-14 shrink-0">
          <h3 className="text-[13px] font-semibold leading-[18px] text-text-primary capitalize-first">
            {header}
          </h3>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      <div 
        className="flex-1 overflow-y-auto px-5 pb-5"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)'
        }}
      >
        <div className="pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
