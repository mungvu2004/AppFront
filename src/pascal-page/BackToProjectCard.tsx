/**
 * Thẻ nhỏ "về dự án" và dải bước của dự án — hai thứ AppFront thêm vào trang Pascal.
 * Nằm đầu khe `viewerToolbarLeft` nên không đè thanh bên; kiểu chép từ `TOOLBAR_CONTAINER`
 * của upstream `viewer-toolbar.tsx`.
 */
import { ArrowLeft, ArrowRight, ChevronDown, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { PROJECT_STEPS } from '@/routes/projectSteps';

import type { PascalSaveStatus } from './bridge/types';

export interface BackToProjectCardProps {
  readonly href: string;
  readonly projectName?: string | undefined;
  /** Trạng thái lưu thật của tầng (cầu); vắng khi chỉ đọc. */
  readonly save?: PascalSaveStatus | undefined;
}

export function BackToProjectCard({ href, projectName, save }: BackToProjectCardProps) {
  return (
    <>
      <BackLink href={href} projectName={projectName} />
      {save !== undefined && <SaveStatusCard save={save} />}
    </>
  );
}

const FOCUS_OUT = 'outline-2 outline-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)]';

function BackLink({ href, projectName }: Omit<BackToProjectCardProps, 'save'>) {
  return (
    <a
      {...(projectName !== undefined ? { 'aria-label': `Về dự án: ${projectName}` } : {})}
      className={`${FOCUS_OUT} inline-flex h-8 max-w-56 items-center gap-1.5 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] motion-reduce:transition-none @max-[800px]/appbar:min-w-8! @max-[800px]/appbar:px-2`}
      href={href}
    >
      <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate @max-[800px]/appbar:sr-only">{projectName ?? 'Về dự án'}</span>
    </a>
  );
}

const CARD = 'h-8 shrink-0 items-center rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)]';
/** Như `CARD` nhưng màu viền/chữ theo trạng thái — hai lớp màu cùng loại thì Tailwind không chắc lớp nào thắng. */
const STATUS_CARD = 'h-8 shrink items-center rounded-xl border bg-[var(--pa-surface)] text-[13px] shadow-[var(--pa-shadow-float)]';
/**
 * FE3D-FIX-004 V10: thông báo nổi (toast) góc phải dưới thanh trên, cổng ra `body` nên không chiếm
 * chỗ trong thanh và đè được canvas (thanh nằm trong khối `clipPath` của vendor).
 */
/** Chồng thông báo nổi góc phải: lỗi lưu ở trên, câu "Chưa lưu được" ở dưới — hai cái không đè nhau. */
const TOAST_STACK = 'fixed top-14 right-3 z-[100] flex flex-col items-end gap-2';
const TOAST =
  'inline-flex min-h-10 max-w-[min(28rem,calc(100vw-2rem))] items-center gap-3 rounded-xl border bg-[var(--pa-surface)] px-4 py-2 text-[14px] leading-[22px] shadow-[var(--pa-shadow-overlay)]';
const ALERT_TONE = 'border-[var(--pa-danger)] text-[var(--pa-danger)]';
const SAVING_TEXT = 'Đang lưu…';
/** Chữ của chip trên thanh khi lưu hỏng; câu đầy đủ nằm ở toast. */
const UNSAVED_CHIP = 'Chưa lưu';

/**
 * Chip lưu của tầng: đang lưu / đã lưu lúc … / lưu thất bại / bị khối kèm "Tải lại tầng" (v3 BE.md
 * major 1), và câu "Chưa lưu được: …" cho phần sửa máy chủ chưa nhận (major 2).
 *
 * Lưu hỏng (B3-09): thanh trên chật nên chip co còn "● Tầ" — chip chỉ ghi "Chưa lưu" (không co), câu
 * đầy đủ và nút "Tải lại tầng" lên toast cổng ra `body`, không bị khối `clipPath` của vendor cắt.
 */
export function SaveStatusCard({ save }: { readonly save: PascalSaveStatus }) {
  const alert = save.state === 'blocked' || save.state === 'failed';
  const alertText = save.state === 'blocked' ? (save.blockMessage ?? 'Tầng này chưa lưu được.') : (save.label ?? 'Lưu thất bại');
  const text = alert ? UNSAVED_CHIP : save.state === 'saving' ? SAVING_TEXT : save.label;

  return (
    <>
      {text !== null && (
        <div
          aria-live="polite"
          className={`${STATUS_CARD} inline-flex min-w-12 max-w-96 gap-2 px-2.5 @max-[1100px]/appbar:max-w-48 ${alert ? `shrink-0 ${ALERT_TONE}` : 'border-[var(--pa-border)] text-[var(--pa-text-2)]'}`}
          role="status"
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${alert ? 'bg-[var(--pa-danger)]' : save.state === 'saving' ? 'bg-[var(--pa-warn)]' : 'bg-[var(--pa-ok)]'}`} />
          <span className="truncate" title={alert ? alertText : text}>
            {text}
          </span>
        </div>
      )}
      {(alert || save.notice !== null) &&
        createPortal(
          <div className={TOAST_STACK} data-appfront-toast="">
            {alert && (
              <div className={`${TOAST} ${ALERT_TONE}`} role="alert">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pa-danger)]" />
                <span>{alertText}</span>
                {save.state === 'blocked' && (
                  <button className={`${FOCUS_OUT} min-h-8 shrink-0 rounded-lg px-2 font-medium text-[var(--pa-accent)] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-accent-hover)]`} onClick={save.onReloadFloor} type="button">
                    Tải lại tầng
                  </button>
                )}
              </div>
            )}
            {save.notice !== null && (
              <div
                className={`${TOAST} ${save.noticeTone === 'alert' ? ALERT_TONE : 'border-[var(--pa-border)] text-[var(--pa-text)]'}`}
                role={save.noticeTone === 'alert' ? 'alert' : 'status'}
              >
                <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${save.noticeTone === 'alert' ? 'bg-[var(--pa-danger)]' : 'bg-[var(--pa-ok)]'}`} />
                <span className="truncate" title={save.notice}>
                  {save.notice}
                </span>
                <button aria-label="Đóng thông báo" className={`${FOCUS_OUT} flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--pa-text-2)] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)]`} onClick={save.dismissNotice} type="button">
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

const VIEWER_STEP = PROJECT_STEPS.findIndex((step) => step.id === 'viewer');

/**
 * Dải sáu bước gọn của dự án (bước "Mô hình 3D" đang mở) và lối "Bước tiếp theo" — trang 3D
 * không có header chung của app nên tự vẽ lại hai thứ này từ cùng bảng `PROJECT_STEPS` (G5-04, N0-07).
 * Khe thanh công cụ hẹp: bước khác chỉ hiện số (tên ở `title`/nhãn đọc); dưới 1536px tên bước
 * hiện tại ẩn và lối tiếp viết gọn "Tiếp:".
 * QA-2 L1: các ngưỡng dưới đây đo theo bề rộng thanh trên (container `appbar`, khai ở pascal.css),
 * không theo khổ màn — thanh bên mở/kéo rộng cũng làm thanh hẹp lại. Thanh < 1400px: dải sáu bước
 * thu thành một chip "bước hiện tại + menu" (`<details>`), < 1200px chip chỉ còn số bước; < 1050px: ẩn
 * lối tiếp (đã có trong menu). FE3D-FIX-004: thêm Ánh sáng + Đổi mẫu nên các ngưỡng nâng lên, mọi nhãn
 * không xuống dòng.
 */
export function ProjectStepsCard({ projectId }: { readonly projectId: string }) {
  const next = PROJECT_STEPS[VIEWER_STEP + 1];
  const current = PROJECT_STEPS[VIEWER_STEP] ?? PROJECT_STEPS[0]!;
  return (
    <>
      <nav aria-label="Các bước của dự án" className={`${CARD} hidden px-1 @min-[1400px]/appbar:inline-flex`}>
        <ol className="flex items-center gap-0.5">
          {PROJECT_STEPS.map((step, index) =>
            index === VIEWER_STEP ? (
              <li key={step.id}>
                <span aria-current="step" className="flex h-6 items-center gap-1.5 rounded-lg bg-[var(--pa-selected)] px-1.5 font-medium text-[var(--pa-accent)]" title={step.label}>
                  <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--pa-accent)] text-[10px] text-[var(--pa-surface)]">
                    {index + 1}
                  </span>
                  <span className="sr-only @min-[1600px]/appbar:not-sr-only">{step.label}</span>
                </span>
              </li>
            ) : (
              <li key={step.id}>
                <a
                  aria-label={`Bước ${index + 1}: ${step.label}`}
                  className={`${FOCUS_OUT} relative flex h-6 w-6 items-center justify-center rounded-lg text-[12px] after:absolute after:-inset-1 after:content-[''] text-[var(--pa-text-2)] transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] motion-reduce:transition-none`}
                  href={step.path(projectId)}
                  title={step.label}
                >
                  {index + 1}
                </a>
              </li>
            ),
          )}
        </ol>
      </nav>
      <details className="relative @min-[1400px]/appbar:hidden" data-appfront-menu="">
        <summary
          aria-label={`Bước ${VIEWER_STEP + 1}/${PROJECT_STEPS.length}: ${current.label} — mở danh sách bước`}
          title={`Bước ${VIEWER_STEP + 1}: ${current.label}`}
          className={`${CARD} flex cursor-pointer list-none gap-1.5 whitespace-nowrap px-2 font-medium transition-colors duration-[120ms] hover:bg-[var(--pa-sunken)] motion-reduce:transition-none ${FOCUS_OUT} [&::-webkit-details-marker]:hidden`}
        >
          <span aria-hidden="true" className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--pa-accent)] text-[10px] text-[var(--pa-surface)]">
            {VIEWER_STEP + 1}
          </span>
          <span className="hidden @min-[1200px]/appbar:inline">{current.label}</span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)] @max-[720px]/appbar:hidden" />
        </summary>
        <ol aria-label="Danh sách bước" className="absolute top-full left-0 z-50 mt-1 min-w-48 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]">
          {PROJECT_STEPS.map((step, index) => (
            <li key={step.id}>
              <a
                {...(index === VIEWER_STEP ? { 'aria-current': 'step' as const } : {})}
                className={`${FOCUS_OUT} flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-[var(--pa-text-2)] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-[current=step]:bg-[var(--pa-selected)] aria-[current=step]:font-medium aria-[current=step]:text-[var(--pa-accent)]`}
                href={step.path(projectId)}
              >
                <span className="w-3 text-[var(--pa-text-3)]">{index + 1}</span>
                {step.label}
              </a>
            </li>
          ))}
        </ol>
      </details>
      {next !== undefined && (
        <a
          aria-label={`Bước tiếp theo: ${next.label}`}
          className={`${FOCUS_OUT} hidden h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-transparent bg-[var(--pa-accent)] px-3 font-medium text-[13px] text-[var(--pa-surface)] shadow-[var(--pa-shadow-float)] transition-colors duration-[120ms] hover:bg-[var(--pa-accent-hover)] active:bg-[var(--pa-accent-active)] motion-reduce:transition-none @min-[1050px]/appbar:inline-flex`}
          href={next.path(projectId)}
        >
          <span className="@min-[1600px]/appbar:hidden">Tiếp:</span>
          <span className="hidden @min-[1600px]/appbar:inline">Bước tiếp theo:</span>
          {next.label}
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </a>
      )}
    </>
  );
}
