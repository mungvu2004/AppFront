import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

// ─── Panel.Header ─────────────────────────────────────────────────────────────

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  action?: React.ReactNode;
}

const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(
  ({ children, action, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-5 h-14 shrink-0', className)}
      {...props}
    >
      <h3 className="text-[13px] font-semibold leading-[18px] text-text-primary capitalize-first">
        {children}
      </h3>
      {action && <div>{action}</div>}
    </div>
  )
);
PanelHeader.displayName = 'Panel.Header';

// ─── Panel.Body ───────────────────────────────────────────────────────────────

const PanelBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex-1 overflow-y-auto px-5 pb-5', className)}
      style={{
        maskImage: 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12px, black calc(100% - 12px), transparent)',
      }}
      {...props}
    >
      <div className="pt-2">{children}</div>
    </div>
  )
);
PanelBody.displayName = 'Panel.Body';

// ─── Panel.Root ───────────────────────────────────────────────────────────────

export interface PanelRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const PanelRoot = forwardRef<HTMLDivElement, PanelRootProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-bg-surface rounded-[12px] shadow-panel overflow-hidden flex flex-col', className)}
      {...props}
    >
      {children}
    </div>
  )
);
PanelRoot.displayName = 'Panel.Root';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Panel = Object.assign(
  // Legacy API: <Panel header={...} headerAction={...}>{children}</Panel>
  forwardRef<HTMLDivElement, LegacyPanelProps>(function PanelLegacy(
    { header, headerAction, children, className, ...props },
    ref
  ) {
    return (
      <PanelRoot ref={ref} className={className} {...props}>
        {header && <PanelHeader action={headerAction}>{header}</PanelHeader>}
        <PanelBody>{children}</PanelBody>
      </PanelRoot>
    );
  }),
  {
    Root: PanelRoot,
    Header: PanelHeader,
    Body: PanelBody,
  }
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

interface LegacyPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}
