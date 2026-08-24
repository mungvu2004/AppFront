/**
 * Left rail: four status counters plus the same status filter as the narrow
 * layout's `SegmentedControl` fallback, laid out as a vertical nav instead.
 * Split out of `ProjectDashboard.tsx` once that file crossed R-22's 400-line
 * cap (mục D).
 */

import { CheckCircle2, Clock, Folder, RotateCw } from 'lucide-react';

import { cn } from '@/lib/utils';

import { PROJECT_STATUS_FILTER_OPTIONS, type ProjectStatusCounts, type ProjectStatusFilter } from './useProjectDashboard';

export interface DashboardSidebarProps {
  readonly statusCounts: ProjectStatusCounts;
  readonly statusFilter: ProjectStatusFilter;
  readonly onStatusFilterChange: (value: ProjectStatusFilter) => void;
}

export function DashboardSidebar({ statusCounts, statusFilter, onStatusFilterChange }: DashboardSidebarProps) {
  const stats = [
    { icon: <Folder size={18} aria-hidden="true" />, count: statusCounts.all, label: 'Tổng dự án', tint: 'bg-accent-wash text-accent' },
    {
      icon: <CheckCircle2 size={18} aria-hidden="true" />,
      count: statusCounts.done,
      label: 'Hoàn thành',
      tint: 'bg-state-verified-tint text-state-verified-text',
    },
    {
      icon: <Clock size={18} aria-hidden="true" />,
      count: statusCounts.qc,
      label: 'Cần QC',
      tint: 'bg-state-attention-tint text-state-attention-text',
    },
    { icon: <RotateCw size={18} aria-hidden="true" />, count: statusCounts.processing, label: 'Đang xử lý', tint: 'bg-bg-sunken text-text-secondary' },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[260px]">
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-border-default bg-bg-surface p-3">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', stat.tint)}>{stat.icon}</span>
            <span className="flex flex-col">
              <span className="text-[18px] font-semibold leading-none text-text-primary">{stat.count}</span>
              <span className="text-[12px] text-text-secondary">{stat.label}</span>
            </span>
          </div>
        ))}
      </div>
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
              <span className={isActive ? 'text-white' : 'text-text-muted'}>{statusCounts[option.value]}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
