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
    <main
      className="flex min-h-screen w-full items-start justify-center bg-bg-app p-12 pt-[15vh]"
      data-auth-state={state}
    >
      <div className="flex w-[360px] max-w-full flex-col gap-6 animate-panel-rise motion-reduce:animate-none">
        <div className="flex flex-col gap-1">
          <h1 className="text-[30px] font-semibold leading-[40px] text-text-primary">{title}</h1>
          {subtitle !== undefined && (
            <p className="text-[15px] leading-[24px] text-text-secondary">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

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
        event.preventDefault();
        onClick();
      }}
      className="self-start text-[14px] leading-[20px] text-accent transition-colors duration-120 hover:text-accent-hover"
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
