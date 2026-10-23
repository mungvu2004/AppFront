import { Link } from 'react-router-dom';

import { cn } from '../../lib/utils';
import { ROUTES } from '../../routes/paths';

/** Tab "Thành viên" của Cài đặt dự án; màn Cài đặt đọc `?tab=` để mở đúng tab. */
const MEMBERS_TAB_QUERY = '?tab=members';

interface ProjectNavEntry {
  readonly id: string;
  readonly label: string;
  readonly to: string;
  /** Mục đang mở khi đường dẫn hiện tại khớp. */
  readonly isActive: (pathname: string, search: string) => boolean;
}

/** Mỗi màn phụ một tên, dùng chung cho menu, tiêu đề màn và đường dẫn trang. */
const PROJECT_NAV_LABELS = {
  versions: 'Lịch sử phiên bản',
  data: 'Dữ liệu dự án',
  graph: 'Sơ đồ xử lý',
  quality: 'Chất lượng ảnh đầu vào',
  members: 'Thành viên',
  settings: 'Cài đặt',
} as const;

function entriesFor(projectId: string): readonly ProjectNavEntry[] {
  const settings = ROUTES.project.settings(projectId);
  const isMembers = (pathname: string, search: string) =>
    pathname === settings && new URLSearchParams(search).get('tab') === 'members';
  return [
    { id: 'versions', label: PROJECT_NAV_LABELS.versions, to: ROUTES.project.versions(projectId), isActive: (p) => p.startsWith(ROUTES.project.versions(projectId)) },
    { id: 'data', label: PROJECT_NAV_LABELS.data, to: ROUTES.project.data(projectId), isActive: (p) => p.startsWith(ROUTES.project.data(projectId)) },
    { id: 'graph', label: PROJECT_NAV_LABELS.graph, to: ROUTES.project.pipelineGraph(projectId), isActive: (p) => p.startsWith(ROUTES.project.pipelineGraph(projectId)) },
    // N0-03: lối mở lại bước nắn ảnh sau khi luồng xử lý đã đi qua (trước đây ở menu "Màn dự án" của Quản lý tầng).
    { id: 'quality', label: PROJECT_NAV_LABELS.quality, to: ROUTES.project.quality(projectId), isActive: (p) => p.startsWith(ROUTES.project.quality(projectId)) },
    { id: 'members', label: PROJECT_NAV_LABELS.members, to: `${settings}${MEMBERS_TAB_QUERY}`, isActive: isMembers },
    { id: 'settings', label: PROJECT_NAV_LABELS.settings, to: settings, isActive: (p, s) => p === settings && !isMembers(p, s) },
  ];
}

interface ProjectNavProps {
  readonly projectId: string;
  /** `location.pathname` của nơi gọi. */
  readonly pathname: string;
  /** `location.search` của nơi gọi (để biết tab Thành viên). */
  readonly search?: string;
  readonly className?: string;
}

/** Dải lối vào có chữ tới các màn phụ của dự án (N0-02, N4-01). View thuần: nơi gọi đưa vị trí hiện tại. */
export function ProjectNav({ className, pathname, projectId, search = '' }: ProjectNavProps) {
  return (
    <nav aria-label="Màn khác của dự án" className={cn('flex min-w-0 items-center', className)}>
      <ul className="flex flex-col gap-0.5">
        {entriesFor(projectId).map((entry) => {
          const active = entry.isActive(pathname, search);
          return (
            <li key={entry.id}>
              <Link
                to={entry.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 fine:min-h-8 items-center whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors duration-120',
                  'outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                  active
                    ? 'bg-bg-selected text-text-primary'
                    : 'text-text-secondary hover:bg-bg-sunken hover:text-text-primary',
                )}
              >
                {entry.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
