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
import { ArrowLeft, ArrowRight, Box, ChevronRight, LogOut } from 'lucide-react';
import { Link, NavLink, useLocation, useMatch, useNavigate } from 'react-router-dom';

import { Avatar } from '@/components/ui/Avatar';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';
import { FLOOR_LAYERS, PROJECT_STEPS } from '@/routes/projectSteps';
import { ProjectNav } from './ProjectNav';

export interface AppHeaderProject {
  readonly id: string;
  /** null khi tên chưa về từ máy chủ. */
  readonly name: string | null;
  /** -1 khi màn hiện tại nằm ngoài sáu bước. */
  readonly stepIndex: number;
  /** Tầng đang mở trong bước 3: ô "Kiểm tra tầng" trỏ về lớp đầu của tầng này. */
  readonly floorId?: string | undefined;
  /** Lớp đang duyệt (chỉ số trong FLOOR_LAYERS): nút chính mời sang lớp kế tiếp trước khi sang 3D. */
  readonly layerIndex?: number | undefined;
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
  const navigate = useNavigate();
  // 'default' = trang mở thẳng (không có màn trước trong app): Back của trình duyệt sẽ rời app.
  const hasHistory = useLocation().key !== 'default';
  const next = PROJECT_STEPS[project.stepIndex + 1];
  const nextLayer = project.floorId !== undefined && project.layerIndex !== undefined && project.layerIndex >= 0
    ? FLOOR_LAYERS[project.layerIndex + 1]
    : undefined;
  const stepPath = (index: number): string =>
    index === 2 && project.floorId !== undefined
      ? (FLOOR_LAYERS[0]?.path(project.id, project.floorId) ?? ROUTES.project.floors(project.id))
      : (PROJECT_STEPS[index]?.path(project.id) ?? ROUTES.dashboard);

  return (
    <nav aria-label="Các bước của dự án" className="flex h-12 items-center gap-3 border-t border-border-default px-4 sm:px-6">
      <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {PROJECT_STEPS.map((step, index) => {
          const isCurrent = index === project.stepIndex;
          return (
            <li key={step.id} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight size={14} aria-hidden="true" className="text-text-muted" />}
              <Link
                to={stepPath(index)}
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
        hasHistory ? (
          <button type="button" onClick={() => navigate(-1)} className={cn(getButtonStyles({ variant: 'secondary', size: 'sm' }), 'shrink-0 gap-2')}>
            <ArrowLeft size={16} aria-hidden="true" />
            Quay lại màn trước
          </button>
        ) : (
          <Link to={ROUTES.project.floors(project.id)} className={cn(getButtonStyles({ variant: 'secondary', size: 'sm' }), 'shrink-0')}>
            Về Quản lý tầng
          </Link>
        )
      ) : nextLayer !== undefined && project.floorId !== undefined ? (
        <Link to={nextLayer.path(project.id, project.floorId)} className={cn(getButtonStyles({ variant: 'primary', size: 'sm' }), 'shrink-0 gap-2')}>
          Tiếp: {nextLayer.label}
          <ArrowRight size={16} aria-hidden="true" />
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
  const adminActive = useMatch('/admin/*') !== null;
  const location = useLocation();
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
            /* Sáng trên mọi màn `/admin/*`, không chỉ màn người dùng mà link trỏ tới. */
            <NavLink to={ROUTES.adminUsers} className={() => navLinkClass({ isActive: adminActive })}>
              Quản trị
            </NavLink>
          )}
        </nav>

        {project !== null && (
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <ChevronRight size={14} aria-hidden="true" className="shrink-0 text-text-muted" />
            <span className="truncate font-medium text-text-primary">{project.name ?? 'Dự án'}</span>
          </div>
        )}
        {project !== null && (
          <ProjectNav projectId={project.id} pathname={location.pathname} search={location.search} className="min-w-0 overflow-x-auto" />
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
