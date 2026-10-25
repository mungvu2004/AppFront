/**
 * One project tile, the same size for every project in the grid (BUG-119). Split out of
 * `ProjectDashboard.tsx` once that file crossed R-22's 400-line cap (mục D).
 *
 * The tile sits inside the "Dự án" `Section`, so it is not a card of its own: no border, no shadow
 * (NGUYEN-TAC-BO-CUC §2 "không thẻ có bóng lồng trong khung"), only a hover wash. Every tile has the same
 * rows in the same order — plan, name + menu, status + progress, one action — so rows line up across the grid
 * whether a project has a plan yet or not (vòng 8: "nhịp hàng không đều").
 *
 * The image area is a plan-outline sketch, not a photo: a per-project sketch (`planSketchOf`), else one of four
 * fixed outlines (`planVariantOf`), drawn only once the project has a traced plan (`hasPlan`). Before that the area
 * says so in words on the same drawing paper — a grey box with a picture icon read as a broken image (vòng 7).
 */

import { ChevronRight, MoreHorizontal, Upload } from 'lucide-react';

import { CONTEXT_MENU_WIDTH } from '@/components/canvas/ContextMenu';
import { motion } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { durationSeconds } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { PLAN_OUTLINE_SEGMENTS } from './projectsGateway';
import type { ProjectCardModel } from './useProjectDashboard';

const NO_PLAN_LABEL = 'Chưa có mặt bằng';
const NO_PLAN_PROGRESS = 'Chưa có tường để duyệt';

function PlanPreview({ variant, sketch }: { readonly variant: 0 | 1 | 2 | 3; readonly sketch?: ProjectCardModel['planSketch'] }) {
  const segments = sketch !== undefined && sketch.length > 0 ? sketch : PLAN_OUTLINE_SEGMENTS[variant];
  return (
    <svg viewBox="0 0 160 96" role="img" aria-label="Sơ đồ mặt bằng" className="h-full w-full">
      <g className="stroke-text-secondary" strokeWidth={1.5} strokeLinecap="square">
        {segments?.map(([x1, y1, x2, y2], index) => (
          <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
    </svg>
  );
}

/** "Duyệt tường ›" — the project's one action, the same verb in the grid and the table. */
export function ProjectActionLink({ project, onOpen }: { readonly project: ProjectCardModel; readonly onOpen: (id: string) => void }) {
  return (
    <button
      type="button"
      // WCAG 2.5.3: the name starts with the words on the button ("Duyệt tường Toà nhà HQ").
      aria-label={`${project.actionLabel} ${project.name}`}
      title={`${project.actionLabel}: ${project.name}`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(project.id);
      }}
      className="flex h-11 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-body-sm font-medium text-accent hover:bg-accent-wash fine:h-8"
    >
      {project.actionLabel}
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  );
}

/** The "…" button: anchored under itself, right edges aligned (BUG-116, BUG-148). */
export function ProjectMenuButton({
  project,
  onMenu,
}: {
  readonly project: ProjectCardModel;
  readonly onMenu: (project: ProjectCardModel, x: number, y: number) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Tuỳ chọn cho ${project.name}`}
      title="Tuỳ chọn"
      onClick={(event) => {
        event.stopPropagation();
        const anchor = event.currentTarget.getBoundingClientRect();
        onMenu(project, anchor.right - CONTEXT_MENU_WIDTH, anchor.bottom + 4);
      }}
      // 44 px on a touch screen, like `Button` (BUG-156); 32 px with a mouse, with a 1 px rim so the target shows.
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-border-default text-text-secondary hover:bg-bg-hover hover:text-text-primary fine:h-8 fine:w-8"
    >
      <MoreHorizontal size={16} aria-hidden="true" />
    </button>
  );
}

export interface ProjectCardTileProps {
  readonly project: ProjectCardModel;
  readonly index: number;
  readonly shouldStagger: boolean;
  readonly renamingId: string | null;
  readonly renameDraft: string;
  readonly onOpen: (id: string) => void;
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
  onMenu,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: ProjectCardTileProps) {
  // Title and rename field share one box — 44 px on a touch screen (the field's touch size, BUG-156), 24 px with a mouse —
  // so swapping one for the other no longer pushes the tile down (BUG-199).
  const titleClassName = 'h-11 text-[15px] font-semibold text-text-primary fine:h-6';

  return (
    <motion.article
      layout
      role="listitem"
      tabIndex={0}
      aria-label={project.name}
      onClick={() => onOpen(project.id)}
      onKeyDown={(event) => {
        // Only the tile's own Enter: one bubbling up from the menu or action button is theirs (BUG-147).
        if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(project.id);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onMenu(project, event.clientX, event.clientY);
      }}
      // No fade-up/stagger on load and no hover lift (aesthetic 2.2 #2); `layout` still animates add/remove.
      transition={{ layout: { duration: durationSeconds('standard') } }}
      className="-m-2 flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg p-2 outline-hidden transition-colors duration-fast hover:bg-bg-hover focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="h-[132px] shrink-0 overflow-hidden rounded-lg border border-border-default bg-canvas-2d p-3">
        {project.hasPlan ? (
          <PlanPreview variant={project.planVariant} sketch={project.planSketch} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-body-sm text-text-secondary">
            <Upload size={18} aria-hidden="true" />
            {NO_PLAN_LABEL}
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
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
            <h3 title={project.name} className={cn(titleClassName, 'truncate leading-[44px] fine:leading-6')}>
              {project.name}
            </h3>
          )}
          <p className="truncate text-body-sm text-text-secondary">
            {project.hasPlan ? `${project.statsLabel}, sửa ${project.updatedLabel}` : `Sửa ${project.updatedLabel}`}
          </p>
        </div>
        <ProjectMenuButton project={project} onMenu={onMenu} />
      </div>

      <div className="flex min-h-[22px] items-center gap-3">
        <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
        {project.hasPlan ? (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-bg-sunken">
              <div className="h-full rounded-full bg-accent" style={{ width: `${String(project.progressRatio * 100)}%` }} />
            </div>
            {/* One way to say it: the count, not the count and a percent too (aesthetic 2.2 #4). */}
            <span className="shrink-0 text-caption tabular-nums text-text-secondary">{project.progressLabel}</span>
          </div>
        ) : (
          <span className="truncate text-caption text-text-secondary">{NO_PLAN_PROGRESS}</span>
        )}
      </div>

      <div className="flex min-h-11 items-center gap-2 border-t border-border-default pt-2 fine:min-h-8">
        {project.members.length > 0 && (
          <Avatar.Stack avatars={project.members.map((member) => ({ initials: member.initials, alt: member.initials }))} max={3} />
        )}
        <span className="ml-auto">
          <ProjectActionLink project={project} onOpen={onOpen} />
        </span>
      </div>
    </motion.article>
  );
}
