/**
 * Vỏ thu gọn cho bốn màn duyệt tầng dạng trình biên tập (`isFloorEditorPath`): ở đó `AppLayout` không vẽ
 * {@link AppHeader}, mà đưa ba mảnh qua context để đầu cột việc (QcFloorNav `stacked`) tự đặt — menu tệp
 * (tên dự án ▾, gồm cả sáu bước của dự án), dòng mờ vị trí ("Bước 3 · Duyệt tầng", chữ, không nút) và chuông.
 * Ngoài bốn màn đó context là null.
 *
 * ponytail: menu dùng `<details>` gốc như header (Esc đóng, không đóng khi bấm ra ngoài); cần thì đổi sang Popover.
 */
import { createContext, useContext, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Skeleton } from '@/components/feedback/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';
import { PROJECT_STEPS, stepPath, stepStateText, type ProjectStepState } from '@/routes/projectSteps';

import { SignOutConfirm, StepMarker } from './AppHeader';
import { ProjectNav } from './ProjectNav';

export interface EditorChrome {
  readonly fileMenu: ReactNode;
  readonly stepLabel: ReactNode;
  readonly bell: ReactNode;
}

const EditorChromeContext = createContext<EditorChrome | null>(null);

export function EditorChromeProvider({ value, children }: { readonly value: EditorChrome | null; readonly children: ReactNode }) {
  return <EditorChromeContext.Provider value={value}>{children}</EditorChromeContext.Provider>;
}

/** null ngoài bốn màn biên tập: thanh của màn giữ nguyên như khi có header chung. */
// eslint-disable-next-line react-refresh/only-export-components -- hook đọc context đứng cạnh Provider của nó
export function useEditorChrome(): EditorChrome | null {
  return useContext(EditorChromeContext);
}

/** A12: Esc đóng menu đang mở và trả tiêu điểm về nút. */
function closeOnEscape(event: KeyboardEvent<HTMLDetailsElement>): void {
  if (event.key !== 'Escape' || !event.currentTarget.open) return;
  event.stopPropagation();
  event.currentTarget.open = false;
  event.currentTarget.querySelector('summary')?.focus();
}

const SUMMARY_CLASS =
  'flex h-8 min-w-0 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-[13px] hover:bg-bg-sunken outline-hidden focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden';
const PANEL_CLASS = 'absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-md border border-border-default bg-bg-surface p-1 shadow-float';
const ITEM_CLASS =
  'flex min-h-8 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-[13px] font-medium text-text-secondary transition-colors duration-fast hover:bg-bg-sunken hover:text-text-primary outline-hidden focus-visible:ring-2 focus-visible:ring-accent';

export interface EditorFileMenuProps {
  readonly projectId: string;
  /** null khi tên chưa về từ máy chủ. */
  readonly projectName: string | null;
  readonly showAdmin: boolean;
  readonly accountInitials?: string | undefined;
  readonly accountLabel: string;
  readonly onSignOut: () => void;
  /** Sáu bước của dự án (`EditorStepList`), giữa lối về và màn phụ. */
  readonly steps?: ReactNode;
}

/** Menu tệp: tên dự án ▾ gom mọi lối của header chung (danh sách dự án, quản trị, bước dự án, màn phụ, tài khoản, đăng xuất). */
export function EditorFileMenu({ projectId, projectName, showAdmin, accountInitials, accountLabel, onSignOut, steps }: EditorFileMenuProps) {
  const location = useLocation();
  const [confirmOut, setConfirmOut] = useState(false);
  return (
    <>
      <details key={location.pathname} className="relative min-w-0" onKeyDown={closeOnEscape}>
        <summary aria-label={projectName === null ? 'Dự án và tài khoản' : `${projectName}: dự án và tài khoản`} className={SUMMARY_CLASS}>
          {projectName === null ? (
            <Skeleton preset="block" className="h-4 w-32" aria-label="Đang tải tên dự án" />
          ) : (
            <span className="max-w-[160px] truncate font-medium text-text-primary" title={projectName}>
              {projectName}
            </span>
          )}
          <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-text-muted" />
        </summary>
        <div className={PANEL_CLASS}>
          <Link to={ROUTES.dashboard} className={ITEM_CLASS}>
            Về danh sách dự án
          </Link>
          {showAdmin && (
            <Link to={ROUTES.adminUsers} className={ITEM_CLASS}>
              Quản trị
            </Link>
          )}
          {steps == null ? null : (
            <>
              <div className="my-1 border-t border-border-default" />
              {steps}
            </>
          )}
          <div className="my-1 border-t border-border-default" />
          <ProjectNav projectId={projectId} pathname={location.pathname} search={location.search} />
          <div className="my-1 border-t border-border-default" />
          <Link to={ROUTES.account} className={ITEM_CLASS} title={accountLabel}>
            <span aria-hidden="true" className="contents">
              <Avatar alt="" {...(accountInitials ? { initials: accountInitials } : {})} />
            </span>
            Tài khoản
          </Link>
          <button type="button" className={ITEM_CLASS} onClick={() => setConfirmOut(true)}>
            <LogOut size={16} aria-hidden="true" />
            Đăng xuất
          </button>
        </div>
      </details>
      <SignOutConfirm isOpen={confirmOut} onClose={() => setConfirmOut(false)} onSignOut={onSignOut} />
    </>
  );
}

export interface EditorStepProps {
  readonly project: {
    readonly id: string;
    readonly stepIndex: number;
    readonly floorId?: string | undefined;
    readonly lastFloorPath?: string | undefined;
    readonly stepStates?: readonly ProjectStepState[] | undefined;
  };
}

/** Dòng mờ vị trí dưới tên dự án (như "Drafts" dưới tên tệp của Figma): chữ, không phải nút. */
export function EditorStepLabel({ project }: EditorStepProps) {
  const current = PROJECT_STEPS[project.stepIndex];
  if (current === undefined) return null;
  return <p className="truncate px-2 text-caption text-text-muted">{`Bước ${project.stepIndex + 1} · ${current.label}`}</p>;
}

/** Sáu bước của dự án kèm trạng thái (cùng khuôn ProjectStepsCard của trang 3D), đặt trong menu tệp. */
export function EditorStepList({ project }: EditorStepProps) {
  return (
    <nav aria-label="Các bước của dự án">
      <ol aria-label="Danh sách bước">
        {PROJECT_STEPS.map((step, index) => {
          const isCurrent = index === project.stepIndex;
          const state = project.stepStates?.[index] ?? 'todo';
          return (
            <li key={step.id}>
              <Link
                to={stepPath(project, index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Bước ${index + 1}: ${step.label}, ${stepStateText(state, index, project.stepIndex)}`}
                className={cn(ITEM_CLASS, isCurrent && 'bg-accent-wash font-semibold text-accent')}
              >
                <StepMarker index={index} isCurrent={isCurrent} state={state} />
                {step.label}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
