'use client'
/**
 * VERBATIM copy of upstream Pascal apps/editor/components/toolbar-tooltip.tsx (F:\pascal-editor, commit cd14090, MIT).
 * Edits: import paths only (`@/components/*`, `@/lib/*` -> relative).
 * AppFront edit (pascal-polish T3): look only (AppFront Tooltip: --pa-text fill, --pa-surface text, 13px, 6px radius,
 * optional `shortcut` chip for keys that already exist).
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type * as React from 'react'
import { cn } from '../lib/utils'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  shortcut,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & { shortcut?: string }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cn(
          'fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 z-50 flex w-fit origin-(--radix-tooltip-content-transform-origin) animate-in items-center gap-2 rounded-md bg-[var(--pa-text)] px-2.5 py-1.5 text-[13px] leading-[18px] text-[var(--pa-surface)] shadow-[var(--pa-shadow-overlay)] data-[state=closed]:animate-out motion-reduce:animate-none',
          className,
        )}
        sideOffset={sideOffset}
        {...props}
      >
        {children}
        {shortcut ? (
          <kbd className="rounded-[4px] border border-[var(--pa-surface)]/30 bg-[var(--pa-surface)]/15 px-1 font-mono text-[11px] leading-4 text-[var(--pa-surface)]">
            {shortcut}
          </kbd>
        ) : null}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-[var(--pa-text)] fill-[var(--pa-text)]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
