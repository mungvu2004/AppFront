/**
 * Header chung của ứng dụng — có mặt ở mọi màn sau đăng nhập (gắn một lần ở
 * `routes/AppLayout.tsx`, không màn nào tự vẽ lại).
 *
 * Hàng trên: thương hiệu · điều hướng chính · tên dự án đang mở · chuông · tài khoản · đăng xuất.
 * Hàng dưới, chỉ khi đang ở trong một dự án: sáu bước của dự án và nút "Bước tiếp theo",
 * để từ bất cứ màn nào cũng đi tiếp được mà không phải quay về danh sách.
 *
 * View thuần: mọi dữ liệu đến qua props; liên kết dùng `Link` của router.
 */
import type { ReactNode } from 'react';
import { ArrowRight, Box, ChevronRight, LogOut, Settings } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';
import { PROJECT_STEPS } from '@/routes/projectSteps';

export interface AppHeaderProject {
  readonly id: string;
  /** null khi tên chưa về từ máy chủ. */
  readonly name: string | null;
  /** -1 khi màn hiện tại nằm ngoài sáu bước. */
  readonly stepIndex: number;
}

export interface AppHeaderProps {
  readonly accountInitials?: string | undefined;
  readonly accountLabel: string;
  readonly showAdmin: boolean;
  readonly notificationBell?: ReactNode;
  readonly project: AppHeaderProject | null;
  readonly onSignOut: () => void;
}

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex h-8 items-center rounded-md px-3 text-[13px] font-medium transition-colors duration-fast',
    isActive ? 'bg-accent-wash text-accent' : 'text-text-secondary hover:bg-bg-sunken hover:text-text-primary',
  );

function ProjectStepBar({ project }: { readonly project: AppHeaderProject }) {
  const next = PROJECT_STEPS[project.stepIndex + 1];

  return (
    <nav aria-label="Các bước của dự án" className="flex h-12 items-center gap-3 border-t border-border-default px-4 sm:px-6">
      <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {PROJECT_STEPS.map((step, index) => {
          const isCurrent = index === project.stepIndex;
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight size={14} aria-hidden="true" className="text-text-muted" />}
              <Link
                to={step.path(project.id)}
                aria-current={isCurrent ? 'step' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors duration-fast',
                  isCurrent ? 'bg-accent-wash font-semibold text-accent' : 'text-text-secondary hover:bg-bg-sunken hover:text-text-primary',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold',
                    isCurrent ? 'bg-accent text-white' : 'bg-bg-sunken text-text-secondary',
                  )}
                >
                  {index + 1}
                </span>
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
      {project.stepIndex === -1 ? (
        <Link to={PROJECT_STEPS[0]?.path(project.id) ?? ROUTES.dashboard} className={getButtonStyles({ variant: 'secondary', size: 'sm' })}>
          Về bước đầu
        </Link>
      ) : (
        next !== undefined && (
          <Link to={next.path(project.id)} className={cn(getButtonStyles({ variant: 'primary', size: 'sm' }), 'shrink-0 gap-2')}>
            Bước tiếp theo: {next.label}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )
      )}
    </nav>
  );
}

export function AppHeader({ accountInitials, accountLabel, showAdmin, notificationBell, project, onSignOut }: AppHeaderProps) {
  return (
    <header className="shrink-0 border-b border-border-default bg-bg-surface">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link to={ROUTES.dashboard} className="flex shrink-0 items-center gap-2 rounded-md text-text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white" aria-hidden="true">
            <Box size={18} />
          </span>
          <span className="text-[15px] font-semibold">AppFront</span>
        </Link>

        <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
          <NavLink to={ROUTES.dashboard} end className={navLinkClass}>
            Dự án
          </NavLink>
          {showAdmin && (
            <NavLink to={ROUTES.adminUsers} className={navLinkClass}>
              Quản trị
            </NavLink>
          )}
        </nav>

        {project !== null && (
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="truncate font-medium text-text-primary">{project.name ?? 'Dự án'}</span>
            <Link
              to={ROUTES.project.settings(project.id)}
              aria-label="Cài đặt dự án"
              title="Cài đặt dự án"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-bg-sunken hover:text-text-primary"
            >
              <Settings size={16} aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {notificationBell}
          <Link to={ROUTES.account} aria-label="Tài khoản của bạn" title={accountLabel} className="rounded-full">
            <Avatar alt="" {...(accountInitials ? { initials: accountInitials } : {})} />
          </Link>
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-bg-sunken hover:text-text-primary"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
      {project !== null && <ProjectStepBar project={project} />}
    </header>
  );
}
