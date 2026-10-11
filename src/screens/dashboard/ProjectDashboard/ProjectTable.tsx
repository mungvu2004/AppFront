/**
 * The dashboard's "Bảng" view: one row per project. Split out of `ProjectDashboard.tsx` once that
 * file crossed R-22's 400-line cap again (mục D), the way the card and the sidebar were.
 *
 * The name column takes what the others leave (`w-full max-w-0`): an 80-char name pushed "Cập nhật"
 * past the 1440 px window (BUG-149). The name wraps onto a second line before it is cut, so at 1024 px a
 * 117 px column still shows all of "E2E-QA-20261011-0028" instead of "E2E-QA-202…".
 *
 * Below `sm` the table is laid out as blocks and each row stacks (`ROW_STACKED`): the name gets the full width on its own line, then
 * status, progress and update time wrap under it, and the header row goes. Three columns side by
 * side at 375 px left the name 98 px — "E2E-QA-20261011-0028" was cut and two rows read the same
 * (BUG-153). The cells stay cells, so the name cell still holds only the name.
 *
 * Below `sm` the name and its rename field share one 32 px box (like the card, FIX-994), so renaming does not
 * grow the stacked row; 32 px rather than the card's 44 keeps every row from growing 24 px (WCAG 2.5.8: >= 24).
 */

import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

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

export function ProjectTable({ rows, renamingId, renameDraft, onOpen, onMenu, onRenameChange, onRenameCommit, onRenameCancel }: ProjectTableProps) {
  return (
    <Table.Root className="max-sm:[&_table]:block max-sm:[&_tbody]:block max-sm:[&_thead]:hidden">
      <Table.Header>
        <tr>
          <Table.Head>Tên dự án</Table.Head>
          <Table.Head>Trạng thái</Table.Head>
          <Table.Head className="hidden sm:table-cell">Chi tiết</Table.Head>
          <Table.Head>Tiến độ duyệt</Table.Head>
          <Table.Head className="hidden sm:table-cell">Cập nhật</Table.Head>
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
              if (event.key === 'Enter') onOpen(project.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onMenu(project, event.clientX, event.clientY);
            }}
          >
            <Table.Cell className={`w-full max-w-0 font-medium max-sm:min-w-0 max-sm:max-w-full max-sm:basis-full ${CELL_STACKED}`}>
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
                  className={`${NAME_CLASS} h-8 rounded border border-accent bg-bg-surface px-1 outline-none sm:h-auto`}
                />
              ) : (
                <h3 className={`${NAME_CLASS} line-clamp-2 whitespace-normal break-words max-sm:leading-8`}>{project.name}</h3>
              )}
            </Table.Cell>
            <Table.Cell className={CELL_STACKED}>
              <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
            </Table.Cell>
            <Table.Cell className="hidden text-text-secondary sm:table-cell">{project.statsLabel}</Table.Cell>
            <Table.Cell className={`text-text-secondary ${CELL_STACKED}`}>{project.progressLabel}</Table.Cell>
            <Table.Cell className={`text-text-muted max-sm:ml-auto ${CELL_STACKED}`}>{project.updatedLabel}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
