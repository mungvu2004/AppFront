import React, { forwardRef, useRef, useState } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { IconButton } from '../ui/IconButton';

// ─── Panel.Header ─────────────────────────────────────────────────────────────

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nhãn section — viết thường kiểu câu (sentence case) */
  title?: string | undefined;
  /** Slot hành động bổ sung ở phải */
  action?: React.ReactNode;
  /** Callback thu gọn panel */
  onCollapse?: (() => void) | undefined;
  /** Hướng nút thu gọn */
  collapseDirection?: 'left' | 'right' | undefined;
}



const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(
  ({ children, title, action, onCollapse, collapseDirection = 'left', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-5 h-14 shrink-0', className)}
      {...props}
    >
      {/* Nhãn section — sentence case, không IN HOA */}
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary leading-none select-none">
        {title ?? children}
      </h3>

      <div className="flex items-center gap-1">
        {action}
        {onCollapse && (
          <IconButton
            icon={
              collapseDirection === 'left'
                ? <ChevronLeft className="w-4 h-4" />
                : <ChevronRight className="w-4 h-4" />
            }
            aria-label={`Thu gọn panel`}
            size="sm"
            tooltip={false}
            onClick={onCollapse}
          />
        )}
      </div>
    </div>
  )
);
PanelHeader.displayName = 'Panel.Header';

// ─── Panel.ScrollSentinel ─────────────────────────────────────────────────────
// Sticky border-top xuất hiện khi body cuộn

function PanelScrollSentinel({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const [isScrolled, setIsScrolled] = useState(false);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 0);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'shrink-0 h-px transition-colors duration-120',
        isScrolled ? 'bg-border-default' : 'bg-transparent'
      )}
    />
  );
}

// ─── Panel.Body ───────────────────────────────────────────────────────────────

const PanelBody = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, className, ...props }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null);
    const scrollRef = (ref as React.RefObject<HTMLDivElement>) ?? internalRef;

    return (
      <>
        <PanelScrollSentinel scrollRef={scrollRef} />
        <div
          ref={scrollRef}
          className={cn('flex-1 overflow-y-auto px-5 pb-5 pt-1', className)}

          {...props}
        >
          {children}
        </div>
      </>
    );
  }
);
PanelBody.displayName = 'Panel.Body';

// ─── Panel.Group ──────────────────────────────────────────────────────────────

export interface PanelGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Nhãn nhóm — sentence case */
  label?: string;
}

const PanelGroup = forwardRef<HTMLDivElement, PanelGroupProps>(
  ({ children, label, className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-3', className)} {...props}>
      {label && (
        <p className="text-[11px] font-medium text-text-muted leading-none select-none pt-1">
          {label}
        </p>
      )}
      {children}
    </div>
  )
);
PanelGroup.displayName = 'Panel.Group';

// ─── Panel.Divider ────────────────────────────────────────────────────────────

const PanelDivider = forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr
      ref={ref}
      aria-hidden="true"
      className={cn('border-none h-px bg-border-default my-0', className)}
      {...props}
    />
  )
);
PanelDivider.displayName = 'Panel.Divider';

// ─── Panel.Root ───────────────────────────────────────────────────────────────

export interface PanelRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const PanelRoot = forwardRef<HTMLDivElement, PanelRootProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-bg-surface rounded-[12px] shadow-panel overflow-hidden flex flex-col',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
PanelRoot.displayName = 'Panel.Root';

// ─── Namespace ────────────────────────────────────────────────────────────────

export const Panel = Object.assign(
  // Legacy API — backward compatible
  forwardRef<HTMLDivElement, LegacyPanelProps>(function PanelLegacy(
    { header, headerAction, children, className, onCollapse, collapseDirection, ...props },
    ref
  ) {
    return (
      <PanelRoot ref={ref} className={className} {...props}>
        {header && (
          <PanelHeader
            title={typeof header === 'string' ? header : undefined}
            action={headerAction}
            onCollapse={onCollapse}
            collapseDirection={collapseDirection}
          >
            {typeof header !== 'string' ? header : undefined}
          </PanelHeader>
        )}
        <PanelBody>{children}</PanelBody>
      </PanelRoot>
    );
  }),
  {
    Root:     PanelRoot,
    Header:   PanelHeader,
    Body:     PanelBody,
    Group:    PanelGroup,
    Divider:  PanelDivider,
  }
);

// ─── Legacy Types ─────────────────────────────────────────────────────────────

interface LegacyPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
  onCollapse?: () => void;
  collapseDirection?: 'left' | 'right';
  children: React.ReactNode;
}
