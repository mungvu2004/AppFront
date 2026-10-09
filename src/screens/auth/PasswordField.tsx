/**
 * Ô mật khẩu của nhóm màn đăng nhập, kèm nút mắt hiện/ẩn chữ đã gõ — một chỗ cho
 * `/login`, nhận lời mời và đặt lại mật khẩu, để ba nơi cư xử như nhau (BUG-051).
 *
 * Hiện hay ẩn là trạng thái hiển thị của riêng ô, không thuộc mô hình: nó không đổi
 * gì trong thứ được gửi đi, nên ở đây chứ không ở hook của màn.
 */

import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input, type InputProps } from '@/components/ui/Input';

/* Nhập THEO TÊN, không default — lý do ở `recoveryShared.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

export interface PasswordFieldProps extends Omit<InputProps, 'type' | 'suffix' | 'hint'> {
  /**
   * Luật của ô, nói trước khi gửi (BUG-049). Không qua `hint` của `Input` vì đoạn ấy không có
   * `id` để `aria-describedby` trỏ tới. Nhường chỗ cho câu lỗi khi có lỗi.
   */
  readonly hint?: string;
}

export function PasswordField({
  disabled,
  hint,
  error,
  id,
  'aria-describedby': callerDescribedBy,
  ...props
}: PasswordFieldProps) {
  const [isVisible, setVisible] = useState(false);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;
  const hasError = error !== undefined && error !== null && error !== '';
  const showHint = hint !== undefined && !hasError;
  const ownDescribedBy = hasError ? `${inputId}-error` : showHint ? `${inputId}-hint` : undefined;
  // Ghép, không đè: mô tả nơi gọi đưa vào vẫn còn bên cạnh câu lỗi/gợi ý của chính ô.
  const describedBy = [callerDescribedBy, ownDescribedBy].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col">
      <Input
        {...props}
        id={inputId}
        error={error}
        aria-describedby={describedBy}
        type={isVisible ? 'text' : 'password'}
        disabled={disabled}
        suffix={
          // `type="button"`: Enter hay bấm trên nút chỉ đổi hiện/ẩn, không bao giờ gửi biểu mẫu (BUG-011).
          // Trạng thái nói bằng NHÃN đổi Hiện/Ẩn, không thêm `aria-pressed`: nhãn đổi cộng nút bật là
          // nói hai lần, mâu thuẫn nhau (APG "Button": nhãn đổi thì không dùng `aria-pressed`).
          <button
            type="button"
            disabled={disabled}
            aria-controls={inputId}
            aria-label={
              isVisible ? AUTH_MESSAGES.actions.hidePassword : AUTH_MESSAGES.actions.showPassword
            }
            onClick={() => {
              setVisible((visible) => !visible);
            }}
            // Vùng bấm 24 px, 44 px dưới 640, icon vẫn 16 px; `-mr-*` ăn vào lề khối suffix để icon gần như không dời (BUG-040).
            // Vòng accent riêng như mọi nút (BUG-036): vòng `focus-within` của ô không nói tiêu điểm đang ở ô hay ở nút.
            // Không `disabled:opacity-*`: ô khoá đã mờ cả khối, mờ thêm ở đây là mờ hai lần.
            className="-mr-3 inline-flex h-11 w-11 items-center justify-center rounded outline-none sm:-mr-1 sm:h-6 sm:w-6 text-text-muted transition-colors duration-120 hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface disabled:cursor-not-allowed"
          >
            {isVisible ? (
              <EyeOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        }
      />
      {/* `text-secondary`, không `text-muted` của gợi ý trong `Input`: muted nay đạt 4,5:1 nhưng chỉ sát
          ngưỡng (4,55:1 trên `--bg-app` sáng, sau BUG-042); luật mật khẩu phải đọc được trước khi gửi nên
          lấy chữ phụ, dư biên hơn (5,06:1 sáng, 7,71:1 tối trên `--bg-app`). */}
      {showHint && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-[13px] leading-[18px] text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
