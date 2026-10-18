/**
 * Left rail: the status filter, each entry with its count — the same filter as the narrow layout's
 * `SegmentedControl` fallback, laid out as a vertical nav instead. Split out of `ProjectDashboard.tsx`
 * once that file crossed R-22's 400-line cap (mục D).
 *
 * Four counter tiles used to sit above it with the very same four counts: one set of numbers shown
 * twice pushed the cards down and read as two sets (BUG-118). The filter keeps the counts (BUG-140).
 */

import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { PROJECT_STATUS_FILTER_OPTIONS, type ProjectStatusCounts, type ProjectStatusFilter } from './useProjectDashboard';

export interface DashboardSidebarProps {
  readonly statusCounts: ProjectStatusCounts;
  readonly countsHidden?: boolean;
  readonly statusFilter: ProjectStatusFilter;
  readonly onStatusFilterChange: (value: ProjectStatusFilter) => void;
}

export function DashboardSidebar({ statusCounts, countsHidden = false, statusFilter, onStatusFilterChange }: DashboardSidebarProps) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[260px]">
      <div className="flex flex-col gap-1 rounded-xl border border-border-default bg-bg-surface p-2">
        {PROJECT_STATUS_FILTER_OPTIONS.map((option) => {
          const isActive = statusFilter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onStatusFilterChange(option.value)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-120',
                isActive ? 'bg-accent text-white' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
              )}
            >
              <span>{option.label}</span>
              <span className={isActive ? 'text-white' : 'text-text-muted'}>{countsHidden ? '–' : statusCounts[option.value]}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

/**
 * The rail's place while N1 loads, from 1024 px up (below it the rail is the filter strip), so the cards start
 * where they stay instead of jumping 284 px right when the list lands (BUG-228). A row per filter entry.
 */
export function DashboardSidebarSkeleton() {
  return (
    <div aria-hidden="true" className="hidden w-[260px] shrink-0 flex-col gap-1 rounded-xl border border-border-default bg-bg-surface p-2 lg:flex">
      {PROJECT_STATUS_FILTER_OPTIONS.map((option) => (
        <Skeleton key={option.value} preset="block" className="h-9" />
      ))}
    </div>
  );
}
