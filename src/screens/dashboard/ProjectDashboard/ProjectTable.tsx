/**
 * The dashboard's "Bảng" view: one row per project. Split out of `ProjectDashboard.tsx` once that
 * file crossed R-22's 400-line cap again (mục D), the way the card and the sidebar were.
 *
 * The name column takes what the others leave (`w-full`) but never less than 16rem: at 1024 px it was
 * squeezed to ~70 px and names broke mid-word (A1 P1). It is one line with an ellipsis and the full name in
 * `title`; "Chi tiết" only shows from `xl` (1280 px). If the columns still need more room, `Table.Root`
 * scrolls sideways with its edge shadow, so the actions column is never cut off.
 *
 * Below `sm` the table is laid out as blocks and each row stacks (`ROW_STACKED`): the name gets the full width on its own line, then
 * status, progress and update time wrap under it, and the header row goes. Three columns side by
 * side at 375 px left the name 98 px — "E2E-QA-20261011-0028" was cut and two rows read the same
 * (BUG-153). The cells stay cells, so the name cell still holds only the name.
 *
 * The rename field overlays the name, which stays as an invisible size box (ND-R3), so renaming never changes the
 * row height: a 2-line name at >= `sm` keeps its 43 px row. Below `sm` the name keeps to one 32 px line (two
 * `leading-8` lines read as double-spaced, and the 64 px box made the field look odd) and the field fills it
 * (like the card, FIX-994); 32 px rather than the card's 44 keeps every row from growing 24 px (WCAG 2.5.8: >= 24).
 * At >= `sm` a 1-line name is a 20 px box, so the field reaches 2 px past it each way (24 px) inside the 40 px row.
 * A 2-line name's field (~44 px) may overlap the neighbouring rows by ~1 px, only while it is open and focused;
 * accepted rather than measuring line count in JS.
 *
 * Stacked, the header row is `display: none`, so a screen reader no longer pairs "Cần duyệt" with "Trạng thái" (and
 * Safari drops the table roles once `display` changes). Each stacked cell says its column itself, below `sm` only.
 */

import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

import { ProjectActionLink, ProjectMenuButton } from './ProjectCardTile';
import type { ProjectCardModel } from './useProjectDashboard';

export interface ProjectTableProps {
  readonly rows: readonly ProjectCardModel[];
  readonly renamingId: string | null;
  readonly renameDraft: string;
  readonly onOpen: (id: string) => void;
  readonly onMenu: (project: ProjectCardModel, x: number, y: number) => void;
  readonly onRenameChange: (value: string) => void;
  readonly onRenameCommit: () => void;
  readonly onRenameCancel: () => void;
}

const NAME_CLASS = 'w-full text-[14px] font-medium text-text-primary';
const ROW_STACKED = 'max-sm:flex max-sm:h-auto max-sm:flex-wrap max-sm:items-center max-sm:gap-y-1 max-sm:py-2';
const CELL_STACKED = 'max-sm:h-auto';

/** The column name a stacked cell reads out below `sm`, where the header row is gone; `sm:hidden` above it. */
function StackedLabel({ children }: { readonly children: string }) {
  return <span className="sr-only sm:hidden">{`${children}: `}</span>;
}

export function ProjectTable({ rows, renamingId, renameDraft, onOpen, onMenu, onRenameChange, onRenameCommit, onRenameCancel }: ProjectTableProps) {
  return (
    <Table.Root className="max-sm:[&_table]:block max-sm:[&_tbody]:block max-sm:[&_thead]:hidden">
      <Table.Header>
        <tr>
          <Table.Head>Tên dự án</Table.Head>
          <Table.Head>Trạng thái</Table.Head>
          <Table.Head className="hidden xl:table-cell">Chi tiết</Table.Head>
          <Table.Head>Tiến độ duyệt</Table.Head>
          <Table.Head className="hidden whitespace-nowrap sm:table-cell">Cập nhật</Table.Head>
          <Table.Head><span className="sr-only">Thao tác</span></Table.Head>
        </tr>
      </Table.Header>
      <Table.Body>
        {rows.map((project) => (
          <Table.Row
            key={project.id}
            tabIndex={0}
            className={`cursor-pointer ${ROW_STACKED}`}
            onClick={() => onOpen(project.id)}
            onKeyDown={(event) => {
              // Only the row's own Enter: one from its action or menu button is theirs (BUG-147, as the tile).
              if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(project.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onMenu(project, event.clientX, event.clientY);
            }}
          >
            <Table.Cell className={`w-full min-w-[16rem] max-w-0 font-medium max-sm:min-w-0 max-sm:max-w-full max-sm:basis-full ${CELL_STACKED}`}>
              <div className="relative">
                <h3
                  aria-hidden={renamingId === project.id || undefined}
                  title={project.name}
                  className={`${NAME_CLASS} truncate max-sm:line-clamp-1 max-sm:leading-8 ${renamingId === project.id ? 'invisible' : ''}`}
                >
                  {project.name}
                </h3>
                {renamingId === project.id && (
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
                    className={`${NAME_CLASS} absolute inset-0 sm:-inset-y-0.5 rounded-sm border border-accent bg-bg-surface px-1 outline-hidden`}
                  />
                )}
              </div>
            </Table.Cell>
            <Table.Cell className={CELL_STACKED}>
              <StackedLabel>Trạng thái</StackedLabel>
              <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
            </Table.Cell>
            <Table.Cell className="hidden text-text-secondary xl:table-cell">{project.statsLabel}</Table.Cell>
            <Table.Cell className={`whitespace-nowrap text-text-secondary ${CELL_STACKED}`}>
              <StackedLabel>Tiến độ duyệt</StackedLabel>
              {project.progressLabel}
            </Table.Cell>
            <Table.Cell className={`whitespace-nowrap text-text-muted max-sm:ml-auto ${CELL_STACKED}`}>
              <StackedLabel>Cập nhật</StackedLabel>
              {project.updatedLabel}
            </Table.Cell>
            <Table.Cell className={`max-sm:ml-auto ${CELL_STACKED}`}>
              <div className="flex items-center justify-end gap-2">
                <ProjectActionLink project={project} onOpen={onOpen} />
                <ProjectMenuButton project={project} onMenu={onMenu} />
              </div>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
