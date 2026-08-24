/**
 * One project card — large ("hero", the most-recently-updated project in the
 * grid) or small ("compact", everything else). Split out of
 * `ProjectDashboard.tsx` once that file crossed R-22's 400-line cap (mục D);
 * nothing here is a new abstraction beyond the card the view already drew.
 *
 * The image area is the plan-outline sketch, not a photo: sized generously
 * for the hero, it's a real trace of the project's own drawing rather than a
 * stock render — this project has no picture of the building to show yet.
 */

import { ArrowUpRight, Building2, Clock, MoreHorizontal } from 'lucide-react';

import { motion } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { durationSeconds } from '@/lib/motion';
import { staggerDelayMs } from '@/lib/motion/stagger';
import { cn } from '@/lib/utils';

import { PLAN_OUTLINE_SEGMENTS } from './projectsGateway';
import type { ProjectCardModel } from './useProjectDashboard';

export type ProjectCardSize = 'hero' | 'compact';

function PlanPreview({ variant }: { readonly variant: 0 | 1 | 2 | 3 }) {
  return (
    <svg viewBox="0 0 160 96" role="img" aria-label="Sơ đồ mặt bằng" className="h-full w-full">
      <g className="stroke-text-muted" strokeWidth={1.5}>
        {PLAN_OUTLINE_SEGMENTS[variant]?.map(([x1, y1, x2, y2], index) => (
          <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}

export interface ProjectCardTileProps {
  readonly project: ProjectCardModel;
  readonly index: number;
  readonly size: ProjectCardSize;
  readonly shouldStagger: boolean;
  readonly renamingId: string | null;
  readonly renameDraft: string;
  readonly onOpen: (id: string) => void;
  readonly onMenu: (project: ProjectCardModel, x: number, y: number) => void;
  readonly onPointerEnter: (id: string) => void;
  readonly onPointerLeave: (id: string) => void;
  readonly onRenameChange: (value: string) => void;
  readonly onRenameCommit: () => void;
  readonly onRenameCancel: () => void;
}

export function ProjectCardTile({
  project,
  index,
  size,
  shouldStagger,
  renamingId,
  renameDraft,
  onOpen,
  onMenu,
  onPointerEnter,
  onPointerLeave,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: ProjectCardTileProps) {
  const titleClassName = cn('font-semibold text-text-primary', size === 'hero' ? 'text-[18px]' : 'text-[15px]');

  return (
    <motion.article
      layout
      role="listitem"
      tabIndex={0}
      aria-label={project.name}
      onClick={() => onOpen(project.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(project.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(project, event.clientX, event.clientY);
      }}
      onPointerEnter={() => onPointerEnter(project.id)}
      onPointerLeave={() => onPointerLeave(project.id)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        layout: { duration: durationSeconds('standard') },
        default: { duration: durationSeconds('fast'), delay: shouldStagger ? staggerDelayMs(index) / 1000 : 0 },
      }}
      className={cn(
        'flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border-default bg-bg-surface shadow-rest outline-none transition-[transform,box-shadow] duration-fast hover:-translate-y-px hover:shadow-float focus-visible:ring-2 focus-visible:ring-accent',
        size === 'hero' && 'lg:flex-1',
      )}
    >
      <div className={cn('relative shrink-0 border-b border-border-default bg-bg-sunken', size === 'hero' ? 'h-[360px]' : 'h-[132px]')}>
        <PlanPreview variant={project.planVariant} />
        <span className="absolute left-3 top-3">
          <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
        </span>
        <button
          type="button"
          aria-label={`Tuỳ chọn cho ${project.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onMenu(project, event.clientX, event.clientY);
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface text-text-secondary shadow-rest hover:text-text-primary"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
      <div className={cn('flex shrink-0 flex-col justify-between gap-2', size === 'hero' ? 'p-5' : 'p-4')}>
        <div className="flex flex-col gap-1">
          {renamingId === project.id ? (
            <input
              autoFocus
              value={renameDraft}
              onChange={(event) => onRenameChange(event.target.value)}
              onBlur={onRenameCommit}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') onRenameCommit();
                if (event.key === 'Escape') onRenameCancel();
              }}
              className={cn(titleClassName, 'rounded border border-accent bg-bg-surface px-1 outline-none')}
            />
          ) : (
            <h3 className={cn(titleClassName, 'truncate')}>{project.name}</h3>
          )}
          <p className="flex items-center gap-1.5 truncate text-[12px] text-text-secondary">
            <Building2 size={12} aria-hidden="true" />
            {project.statsLabel}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken">
            <div className="h-full rounded-full bg-accent" style={{ width: `${String(project.progressRatio * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-text-muted">
            <span>{project.progressLabel}</span>
            <span className="font-medium text-text-secondary">{project.progressPercentLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {project.members.length > 0 && (
            <Avatar.Stack avatars={project.members.map((member) => ({ initials: member.initials, alt: member.initials }))} max={3} />
          )}
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-[11px] text-text-muted">
            <Clock size={11} aria-hidden="true" />
            {project.updatedLabel}
          </span>
          <button
            type="button"
            aria-label={`Mở ${project.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpen(project.id);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-sunken text-text-secondary hover:bg-accent hover:text-white"
          >
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
