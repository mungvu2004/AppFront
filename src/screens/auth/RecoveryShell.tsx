/**
 * Khung chung của hai màn mở từ đường dẫn trong thư: đặt lại mật khẩu và nhận lời
 * mời. View thuần — mọi chữ đến qua props. Nằm trong thư mục màn chứ không ở
 * `src/components`: nó chỉ có hai nơi dùng và cả hai là màn của nhóm này.
 */

import { InlineAlert } from '@/components/feedback/InlineAlert';

import type { RecoveryNotice } from './recoveryShared';

export interface RecoveryShellProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Trạng thái trong bảy, dưới dạng thuộc tính `data-` — đọc được bởi bài kiểm, im với người dùng. */
  readonly state: string;
  readonly children: React.ReactNode;
}

export function RecoveryShell({ title, subtitle, state, children }: RecoveryShellProps) {
  return (
    // Neo từ trên, không căn giữa dọc: căn giữa thì dải lỗi chèn vào đẩy cả khối, ô nhập trôi khỏi con trỏ (BUG-008).
    // Lề 24 px dưới 640, 48 px từ đó: ở 375 lề 48 px chỉ để lại cột ~279 px (BUG-052).
    <main
      className="flex min-h-screen w-full items-start justify-center bg-bg-app px-6 pb-6 pt-[15vh] sm:px-12 sm:pb-12"
      data-auth-state={state}
    >
      <div className="flex w-[360px] max-w-full flex-col gap-6 animate-panel-rise motion-reduce:animate-none">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-semibold leading-[40px] text-text-primary">{title}</h1>
          {subtitle !== undefined && (
            // `text-balance` (không `pretty`: Firefox chưa hỗ trợ): không để "bạn." một mình ở dòng cuối (BUG-052).
            <p className="text-balance text-[15px] leading-[24px] text-text-secondary">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * Chỗ dành sẵn cho câu lỗi hai dòng dưới một ô (`wrapperClassName` của `Input`): câu hiện ra hay
 * biến mất không đẩy ô dưới và nút gửi khỏi chỗ con trỏ (BUG-008). Cộng từ `Input`: nhãn 20 + 8,
 * ô 46 (38 từ `sm`), dòng lỗi 6 + 2 × 18. Câu lỗi dài nhất của `/login` vừa hai dòng ở cột từ
 * ~258 px (màn 320 trừ lề 24 px mỗi bên). Chỗ này đã là khoảng cách giữa hai ô — đừng thêm `gap`.
 */
export const FIELD_ERROR_SLOT = 'min-h-[116px] sm:min-h-[108px]';

export function RecoveryNoticeStrip({ notice }: { readonly notice: RecoveryNotice | null }) {
  if (notice === null) {
    return null;
  }

  return (
    <InlineAlert
      level={notice.tone}
      {...(notice.title !== undefined ? { title: notice.title } : {})}
      message={notice.message}
    />
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
        // Chỉ cú bấm trái trơn đi trong ứng dụng; Ctrl/Cmd/Shift/Alt hay nút giữa là trình duyệt
        // mở tab/cửa sổ mới hoặc tải xuống — để nó làm (nợ QA-01b #10).
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
          return;
        }

        event.preventDefault();
        onClick();
      }}
      className="self-start py-1 text-[14px] leading-[20px] text-accent-hover transition-colors duration-120 hover:text-accent-active rounded outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
    >
      {label}
    </a>
  );
}

export interface RecoveryDeadEndProps {
  readonly message: string;
  readonly linkLabel: string;
  readonly href: string;
  readonly onLinkClick: () => void;
}

/** Mã không dùng được nữa: không còn biểu mẫu, chỉ một câu và đường về `/login`. */
export function RecoveryDeadEnd({ message, linkLabel, href, onLinkClick }: RecoveryDeadEndProps) {
  return (
    <div className="flex flex-col gap-4">
      <InlineAlert level="attention" message={message} />
      <RecoveryLink label={linkLabel} href={href} onClick={onLinkClick} />
    </div>
  );
}
