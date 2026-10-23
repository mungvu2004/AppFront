/**
 * One project card, the same size for every project in the grid (BUG-119). Split out of
 * `ProjectDashboard.tsx` once that file crossed R-22's 400-line cap (mục D);
 * nothing here is a new abstraction beyond the card the view already drew.
 *
 * The image area is a plan-outline sketch, not a photo: a per-project sketch
 * (`planSketchOf`: wall count + area + id), else one of four fixed outlines (`planVariantOf`), drawn only once the project
 * has a traced plan (`hasPlan`); before that the card says so instead of
 * showing rooms that do not exist (BUG-119).
 */

import { ArrowUpRight, Box, Building2, Clock, FileImage, MoreHorizontal } from 'lucide-react';

import { CONTEXT_MENU_WIDTH } from '@/components/canvas/ContextMenu';
import { motion } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { PLAN_OUTLINE_SEGMENTS } from './projectsGateway';
import type { ProjectCardModel } from './useProjectDashboard';

const NO_PLAN_LABEL = 'Chưa có mặt bằng';
const NO_PLAN_CTA = 'Tải bản vẽ cho tầng đầu';

function PlanPreview({ variant, sketch }: { readonly variant: 0 | 1 | 2 | 3; readonly sketch?: ProjectCardModel['planSketch'] }) {
  const segments = sketch !== undefined && sketch.length > 0 ? sketch : PLAN_OUTLINE_SEGMENTS[variant];
  return (
    <svg viewBox="0 0 160 96" role="img" aria-label="Sơ đồ mặt bằng" className="h-full w-full">
      <g className="stroke-text-muted" strokeWidth={1.5} strokeLinecap="square">
        {segments?.map(([x1, y1, x2, y2], index) => (
          <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}

export interface ProjectCardTileProps {
  readonly project: ProjectCardModel;
  readonly index: number;
  readonly shouldStagger: boolean;
  readonly renamingId: string | null;
  readonly renameDraft: string;
  readonly onOpen: (id: string) => void;
  readonly onOpenViewer: (id: string) => void;
  readonly onMenu: (project: ProjectCardModel, x: number, y: number) => void;
  readonly onRenameChange: (value: string) => void;
  readonly onRenameCommit: () => void;
  readonly onRenameCancel: () => void;
}

export function ProjectCardTile({
  project,
  renamingId,
  renameDraft,
  onOpen,
  onOpenViewer,
  onMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: ProjectCardTileProps) {
  // Title and rename field share one box — 44 px on a touch screen (the field's touch size, BUG-156), 24 px with a mouse —
  // so swapping one for the other no longer pushes the card down (+16 px at 375, +2 at 1440: BUG-199).
  const titleClassName = 'h-11 text-[15px] font-semibold text-text-primary fine:h-6';

  return (
    <motion.article
      layout
      role="listitem"
      tabIndex={0}
      aria-label={project.name}
      onClick={() => onOpen(project.id)}
      onKeyDown={(event) => {
        // Only the card's own Enter: one bubbling up from the menu or "Mở" button is theirs (BUG-147).
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(project.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(project, event.clientX, event.clientY);
      }}
      // No fade-up/stagger on load and no hover lift (aesthetic 2.2 #2); `layout` still animates add/remove.
      transition={{ layout: { duration: durationSeconds('standard') } }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-border-default bg-bg-surface outline-hidden transition-colors duration-fast hover:border-border-control focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="relative h-[132px] shrink-0 border-b border-border-default bg-bg-sunken">
        {/* Below the badge/menu row, so no stroke runs through the status label (BUG-119). */}
        <div className="absolute left-4 right-4 bottom-3 top-14">
          {project.hasPlan ? (
            <PlanPreview variant={project.planVariant} sketch={project.planSketch} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[12px] text-text-muted">
              <FileImage size={20} aria-hidden="true" />
              {NO_PLAN_LABEL}
            </div>
          )}
        </div>
        <span className="absolute left-3 top-3">
          <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
        </span>
        <button
          type="button"
          aria-label={`Tuỳ chọn cho ${project.name}`}
          onClick={(event) => {
            event.stopPropagation();
            // Anchored under the button, right edges aligned: the pointer spot put the menu over its own
            // button (BUG-116), and a keyboard click reports 0,0 — the window's corner (BUG-148).
            const anchor = event.currentTarget.getBoundingClientRect();
            onMenu(project, anchor.right - CONTEXT_MENU_WIDTH, anchor.bottom + 4);
          }}
          // 44 px on a touch screen, like `Button` (BUG-156); 32 px with a mouse.
          title="Tuỳ chọn"
          className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-bg-surface text-text-secondary shadow-rest hover:text-text-primary fine:h-8 fine:w-8"
        >
          <MoreHorizontal size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="flex shrink-0 flex-col justify-between gap-2 p-4">
        <div className="flex flex-col gap-1">
          {renamingId === project.id ? (
            <input
              autoFocus
              aria-label={`Đổi tên ${project.name}`}
              value={renameDraft}
              onChange={(event) => onRenameChange(event.target.value)}
              onBlur={onRenameCommit}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') onRenameCommit();
                if (event.key === 'Escape') onRenameCancel();
              }}
              className={cn(titleClassName, 'rounded-sm border border-accent bg-bg-surface px-1 outline-hidden')}
            />
          ) : (
            <h3 className={cn(titleClassName, 'truncate leading-[44px] fine:leading-6')}>{project.name}</h3>
          )}
          {project.hasPlan && (
            <p className="flex items-center gap-1.5 truncate text-caption text-text-secondary">
              <Building2 size={12} aria-hidden="true" />
              {project.statsLabel}
            </p>
          )}
        </div>
        {project.hasPlan ? (
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-sunken">
              <div className="h-full rounded-full bg-accent" style={{ width: `${String(project.progressRatio * 100)}%` }} />
            </div>
            {/* One way to say it: the count, not the count and a percent too (aesthetic 2.2 #4). */}
            <span className="text-[11px] tabular-nums text-text-muted">{project.progressLabel}</span>
          </div>
        ) : (
          // Chưa có bản vẽ thì "0,00 m²" và "0/0 tường 0%" chỉ là nhiễu (A1 P3): nói việc cần làm tiếp.
          <p className="flex items-center gap-1.5 text-body-sm font-medium text-accent">
            <FileImage size={14} aria-hidden="true" />
            {NO_PLAN_CTA}
          </p>
        )}
        <div className="flex items-center gap-2">
          {project.members.length > 0 && (
            <Avatar.Stack avatars={project.members.map((member) => ({ initials: member.initials, alt: member.initials }))} max={3} />
          )}
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-caption text-text-muted">
            <Clock size={12} aria-hidden="true" />
            {project.updatedLabel}
          </span>
          {/* Chỉ khi đã có mặt bằng: chưa dò được tường thì chưa có gì để dựng 3D. */}
          {project.hasPlan && (
            <button
              type="button"
              aria-label={`Xem 3D ${project.name}`}
              title="Xem mô hình 3D"
              onClick={(event) => {
                event.stopPropagation();
                onOpenViewer(project.id);
              }}
              className="flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-bg-sunken px-3 text-caption font-medium text-text-secondary hover:bg-accent hover:text-white fine:h-8"
            >
              <Box size={14} aria-hidden="true" />
              Xem 3D
            </button>
          )}
          <button
            type="button"
            aria-label={`Mở ${project.name}`}
            title="Mở dự án"
            onClick={(event) => {
              event.stopPropagation();
              onOpen(project.id);
            }}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bg-sunken text-text-secondary hover:bg-accent hover:text-white fine:h-8 fine:w-8"
          >
            <ArrowUpRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}
