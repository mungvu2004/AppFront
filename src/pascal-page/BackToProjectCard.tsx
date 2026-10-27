/**
 * Thẻ nhỏ "về dự án" và dải bước của dự án — hai thứ AppFront thêm vào trang Pascal.
 * Nằm đầu khe `viewerToolbarLeft` nên không đè thanh bên; kiểu chép từ `TOOLBAR_CONTAINER`
 * của upstream `viewer-toolbar.tsx`.
 */
import { ArrowLeft, ArrowRight, ChevronDown, Eye, PencilRuler, TriangleAlert, X } from 'lucide-react';
import { createPortal } from 'react-dom';

import { ROUTES } from '@/routes/paths';
import { PROJECT_STEPS } from '@/routes/projectSteps';

import type { PascalSaveStatus } from './bridge/types';
import { SCALE_NEXT_REASON } from './scaleBanner';
import { useScaleUnresolvedFloor } from './scaleUnresolved';

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
      {save !== undefined ? <SaveStatusCard save={save} /> : <ReadOnlyChip />}
    </>
  );
}

/**
 * UX-R2 K35: trang mở để XEM mô hình — bảng công cụ dựng thu gọn (upstream page.tsx). Nút này mở
 * nó ở thẻ "Dựng"; bảng đang mở thì nút ẩn đi (thanh dọc vẫn đóng/mở được như cũ).
 */
export function EditModelButton({ collapsed, onOpen }: { readonly collapsed: boolean; readonly onOpen: () => void }) {
  if (!collapsed) return null;
  return (
    <button
      className={`${CARD} ${FOCUS_OUT} inline-flex cursor-pointer gap-1.5 whitespace-nowrap px-2.5 font-medium transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none`}
      onClick={onOpen}
      type="button"
    >
      <PencilRuler aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      Sửa mô hình
    </button>
  );
}

/** A11: vai chỉ xem thì màn nói vì sao không sửa được (cầu không trả `save` khi chỉ đọc). */
export const READ_ONLY_REASON = 'Bạn đang xem ở vai người xem nên không sửa được mô hình 3D.';

function ReadOnlyChip() {
  return (
    <div className={`${CARD} inline-flex gap-1.5 px-2.5 text-[var(--pa-text-2)]`} role="note" title={READ_ONLY_REASON}>
      <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span aria-hidden="true">Chỉ xem</span>
      <span className="sr-only">{READ_ONLY_REASON}</span>
    </div>
  );
}

const FOCUS_OUT = 'outline-2 outline-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pa-accent)]';

function BackLink({ href, projectName }: Omit<BackToProjectCardProps, 'save'>) {
  return (
    <a
      {...(projectName !== undefined ? { 'aria-label': `Về dự án: ${projectName}` } : {})}
      className={`${FOCUS_OUT} inline-flex h-8 max-w-56 items-center gap-1.5 @min-[1500px]/appbar:max-w-80 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] px-2.5 font-medium text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-float)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none @max-[800px]/appbar:min-w-8! @max-[800px]/appbar:px-2`}
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

/** Cổng đủ điều kiện: nút chính "Sang <bước sau>". Tỷ lệ chưa hiệu chỉnh: nút phụ dẫn tới việc còn thiếu. */
const NEXT_OK = 'border-transparent bg-[var(--pa-accent)] text-[var(--pa-surface)] hover:bg-[var(--pa-accent-hover)] active:bg-[var(--pa-accent-active)]';
const NEXT_TODO = 'border-[var(--pa-border)] bg-[var(--pa-surface)] text-[var(--pa-text)] hover:bg-[var(--pa-sunken)]';
const NEXT_LINK = `${FOCUS_OUT} inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border px-3 @max-[800px]/appbar:px-2 font-medium text-[13px] shadow-[var(--pa-shadow-float)] transition-colors duration-120 motion-reduce:transition-none`;

const VIEWER_STEP = PROJECT_STEPS.findIndex((step) => step.id === 'viewer');

/**
 * Cụm "bước của dự án" trên thanh 3D (G5-04, N0-07; UI-1023 V-01): trang 3D không có header chung
 * của app nên tự vẽ lại từ cùng bảng `PROJECT_STEPS`. Một cụm có nhãn, luôn cùng một chỗ (ngay sau
 * thẻ về dự án): chip "Bước 4 · Mô hình 3D + menu sáu bước" rồi MỘT nút cổng (HOP-DONG-V6 §1):
 * đủ điều kiện = nút chính "Sang Quy chuẩn"; tỷ lệ chưa hiệu chỉnh = nút phụ "Đặt tỷ lệ" (cùng tên với dải cảnh báo, UX-R2 K35) tới màn
 * tỷ lệ của tầng sai (bước sau vẫn mở được từ menu bước — tỷ lệ là khuyến nghị, không khoá).
 * Ngưỡng theo bề rộng thanh (container `appbar`, pascal.css): < 1500px chip chỉ còn số bước (tên ở
 * `title`) để nhường chỗ cho tên đầy đủ của nút cổng từ 1200px; 800–1199px nút còn "Quy chuẩn →" /
 * "Tỷ lệ"; < 800px chỉ còn biểu tượng (tên ở `aria-label`/`title`). Nút không bao giờ ẩn.
 */
export function ProjectStepsCard({ projectId }: { readonly projectId: string }) {
  const next = PROJECT_STEPS[VIEWER_STEP + 1];
  const current = PROJECT_STEPS[VIEWER_STEP] ?? PROJECT_STEPS[0]!;
  const scaleFloor = useScaleUnresolvedFloor();
  return (
    <nav aria-label="Các bước của dự án" className="inline-flex shrink-0 items-center gap-1.5">
      <details className="relative" data-appfront-menu="">
        <summary
          aria-label={`Bước ${VIEWER_STEP + 1}/${PROJECT_STEPS.length}: ${current.label} — mở danh sách bước`}
          title={`Bước ${VIEWER_STEP + 1}: ${current.label}`}
          className={`${CARD} flex cursor-pointer list-none gap-1.5 whitespace-nowrap px-2 font-medium transition-colors duration-120 hover:bg-[var(--pa-sunken)] motion-reduce:transition-none ${FOCUS_OUT} [&::-webkit-details-marker]:hidden`}
        >
          <span>
            Bước {VIEWER_STEP + 1} · {current.label}
          </span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-text-3)] @max-[720px]/appbar:hidden" />
        </summary>
        <ol aria-label="Danh sách bước" className="absolute top-full left-0 z-50 mt-1 min-w-48 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-1 text-[13px] text-[var(--pa-text)] shadow-[var(--pa-shadow-overlay)]">
          {PROJECT_STEPS.map((step, index) => (
            <li key={step.id}>
              <a
                // UX-R2 K40: bước đang mở cũng có tên (trước chỉ có `aria-current`, tên đọc ra rỗng).
                {...(index === VIEWER_STEP ? { 'aria-current': 'step' as const } : {})}
                aria-label={`Bước ${index + 1}: ${step.label}`}
                className={`${FOCUS_OUT} flex h-8 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-[var(--pa-text-2)] hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-[current=step]:bg-[var(--pa-selected)] aria-[current=step]:font-medium aria-[current=step]:text-[var(--pa-accent)]`}
                href={step.path(projectId)}
              >
                <span className="w-3 tabular-nums text-[var(--pa-text-3)]">{index + 1}</span>
                {step.label}
              </a>
            </li>
          ))}
        </ol>
      </details>
      {next !== undefined &&
        (scaleFloor !== null ? (
          <a
            aria-label={`Đặt tỷ lệ trước khi sang ${next.label}`}
            className={`${NEXT_LINK} ${NEXT_TODO}`}
            data-appfront-gate="todo"
            href={ROUTES.project.scale(projectId, scaleFloor)}
            title={SCALE_NEXT_REASON}
          >
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[var(--pa-warn)]" />
            <span className="@max-[800px]/appbar:hidden @min-[1200px]/appbar:hidden">Tỷ lệ</span>
            <span className="hidden @min-[1200px]/appbar:inline">Đặt tỷ lệ</span>
          </a>
        ) : (
          <a
            aria-label={`Sang ${next.label}`}
            className={`${NEXT_LINK} ${NEXT_OK}`}
            data-appfront-gate="ready"
            href={next.path(projectId)}
            title={`Sang bước ${VIEWER_STEP + 2}: ${next.label}`}
          >
            <span className="@max-[800px]/appbar:sr-only">
              <span className="hidden @min-[1200px]/appbar:inline">Sang </span>
              {next.label}
            </span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          </a>
        ))}
    </nav>
  );
}
