/**
 * The dashboard's "Bảng" view: one row per project. Split out of `ProjectDashboard.tsx` once that
 * file crossed R-22's 400-line cap again (mục D), the way the card and the sidebar were.
 *
 * The name column takes what the others leave and truncates (`w-full max-w-0`): an 80-char name
 * pushed "Cập nhật" past the 1440 px window (BUG-149). Below `sm` the two secondary columns go and
 * progress is a percentage, so status and progress stay on screen at 375 px (BUG-153).
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

export function ProjectTable({ rows, renamingId, renameDraft, onOpen, onMenu, onRenameChange, onRenameCommit, onRenameCancel }: ProjectTableProps) {
  return (
    <Table.Root>
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
            className="cursor-pointer"
            onClick={() => onOpen(project.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onOpen(project.id);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onMenu(project, event.clientX, event.clientY);
            }}
          >
            <Table.Cell className="w-full max-w-0 font-medium">
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
                  className={`${NAME_CLASS} h-11 rounded border border-accent bg-bg-surface px-1 outline-none sm:h-auto`}
                />
              ) : (
                <h3 className={`${NAME_CLASS} truncate`}>{project.name}</h3>
              )}
            </Table.Cell>
            <Table.Cell>
              <Badge variant={project.statusVariant}>{project.statusLabel}</Badge>
            </Table.Cell>
            <Table.Cell className="hidden text-text-secondary sm:table-cell">{project.statsLabel}</Table.Cell>
            <Table.Cell className="text-text-secondary">
              <span className="sm:hidden">{project.progressPercentLabel}</span>
              <span className="hidden sm:inline">{project.progressLabel}</span>
            </Table.Cell>
            <Table.Cell className="hidden text-text-muted sm:table-cell">{project.updatedLabel}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
