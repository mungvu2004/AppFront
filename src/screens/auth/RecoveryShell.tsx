/**
 * Khung chung của hai màn mở từ đường dẫn trong thư: đặt lại mật khẩu và nhận lời
 * mời. View thuần — mọi chữ đến qua props. Nằm trong thư mục màn chứ không ở
 * `src/components`: nó chỉ có hai nơi dùng và cả hai là màn của nhóm này.
 */

import { CheckCircle2, type LucideIcon } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';

import { AuthFrame } from './AuthFrame';
import type { RecoveryNotice } from './recoveryShared';

export interface RecoveryShellProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Trạng thái trong bảy, dưới dạng thuộc tính `data-` — đọc được bởi bài kiểm, im với người dùng. */
  readonly state: string;
  readonly children: React.ReactNode;
}

export function RecoveryShell({ title, subtitle, state, children }: RecoveryShellProps) {
  // Cùng một khung với /login (A1 P2 #5): giấy, mực, logo và cột minh hoạ như nhau ở cả bốn màn.
  return (
    <AuthFrame state={state} title={title} subtitle={subtitle}>
      {children}
    </AuthFrame>
  );
}

/**
 * Chỗ dành sẵn cho câu lỗi hai dòng dưới một ô (`wrapperClassName` của `Input`): câu hiện ra hay
 * biến mất không đẩy ô dưới và nút gửi khỏi chỗ con trỏ (BUG-008). Cộng từ `Input`: nhãn 20 + 8,
 * ô 46 (38 từ `sm`), dòng lỗi 6 + 2 × 18, thêm 16 để câu hai dòng vẫn cách nhãn/nút kế 16 px — 4 px
 * cũ làm câu dính nhãn ô dưới (BUG-073). Câu lỗi dài nhất của `/login` vừa hai dòng ở cột từ ~258 px
 * (màn 320 trừ lề 24 px mỗi bên). Chỗ này đã là khoảng cách giữa hai ô — đừng thêm `gap`.
 */
// A1 P2 #5: chỗ chờ cố định 132 px làm biểu mẫu thưa. Giờ chỉ giữ chỗ cho MỘT dòng lỗi; câu dài hơn mới đẩy
// phần dưới — chấp nhận, vì nó chỉ xảy ra sau khi người dùng đã rời ô (blur), không lúc đang gõ.
export const FIELD_ERROR_SLOT = 'min-h-[96px] fine:min-h-[88px]';

/**
 * Như {@link FIELD_ERROR_SLOT} nhưng cho câu lỗi BA dòng: thêm một dòng 18. Dành cho ô họ tên của
 * lời mời — `fullNameInvalid` (109 ký tự) xuống ba dòng ở cột 375 px (QA-01c nợ #10).
 */
export const FIELD_ERROR_SLOT_THREE_LINES = 'min-h-[96px] fine:min-h-[88px]';

export function RecoveryNoticeStrip({ notice }: { readonly notice: RecoveryNotice | null }) {
  if (notice === null) {
    return null;
  }

  return (
    <InlineAlert
      level={notice.tone}
      titleAs="h2"
      {...(notice.title !== undefined ? { title: notice.title } : {})}
      message={notice.message}
    />
  );
}

/**
 * Vùng trạng thái ngay dưới nút gửi, ở cả hai màn (BUG-097): câu "đã xong" trong một khối có viền và
 * dấu kiểm như câu "đã gửi" của quên mật khẩu (BUG-022) — trung tính, không xanh "verified" (A5) —
 * hoặc một dòng ghi chú nhỏ. Luôn gắn sẵn, điền sau: vùng chèn cùng lúc với chữ thường không được đọc.
 * Quên mật khẩu dùng chung khối này với biểu tượng thư (`icon={Mail}`).
 */
export function RecoveryStatus({
  success,
  note = null,
  icon: Icon = CheckCircle2,
}: {
  readonly success: string | null;
  readonly note?: string | null;
  readonly icon?: LucideIcon;
}) {
  return (
    <div role="status" className="empty:sr-only">
      {success !== null ? (
        <div className="flex items-start gap-3 rounded-lg border border-border-default p-3">
          <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-text-secondary" strokeWidth={2} />
          <p className="text-[14px] leading-relaxed text-text-primary">{success}</p>
        </div>
      ) : note !== null ? (
        <p className="text-[13px] leading-[18px] text-text-secondary">{note}</p>
      ) : null}
    </div>
  );
}

export interface RecoveryLinkProps {
  readonly label: string;
  readonly href: string;
  readonly onClick: () => void;
}

/** Đường về `/login` của nhóm màn này — một chỗ, để ngõ cụt và màn lời mời căn như nhau (BUG-026). */
export function RecoveryLink({ label, href, onClick }: RecoveryLinkProps) {
  return (
    <a
      href={href}
      onClick={(event) => {
        // Chỉ cú bấm trơn đi trong ứng dụng; Ctrl/Cmd/Shift/Alt là trình duyệt mở tab/cửa sổ mới hoặc
        // tải xuống — để nó làm (nợ QA-01b #10). Nút giữa thường phát `auxclick`, vẫn chặn phòng xa.
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
          return;
        }

        event.preventDefault();
        onClick();
      }}
      // Vùng chạm 44 px trên màn cảm ứng, 24 px với chuột — giữ cỡ chữ (BUG-041); ở ngõ cụt đây là lối đi duy nhất.
      // `self-start` ở cả bốn màn: link phụ cùng căn trái với biểu mẫu (A1 heuristic 4).
      className="inline-flex min-h-11 items-center self-start py-1 text-[14px] fine:min-h-6 leading-5 text-accent-hover transition-colors duration-120 hover:text-accent-active rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
    >
      {label}
    </a>
  );
}

export interface RecoveryDeadEndProps {
  readonly message: string;
  /** Không có thì chỉ còn câu báo: màn tự đặt lối đi (đặt lại mật khẩu: "Gửi lại liên kết" + về /login). */
  readonly link?: RecoveryLinkProps | undefined;
}

/** Mã không dùng được nữa: không còn biểu mẫu, chỉ một câu và đường đi tiếp. */
export function RecoveryDeadEnd({ message, link }: RecoveryDeadEndProps) {
  return (
    <div className="flex flex-col gap-4">
      <InlineAlert level="attention" message={message} />
      {link !== undefined && <RecoveryLink {...link} />}
    </div>
  );
}
