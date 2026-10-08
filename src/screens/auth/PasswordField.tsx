/**
 * Ô mật khẩu của nhóm màn đăng nhập, kèm nút mắt hiện/ẩn chữ đã gõ — một chỗ cho
 * `/login`, nhận lời mời và đặt lại mật khẩu, để ba nơi cư xử như nhau (BUG-051).
 *
 * Hiện hay ẩn là trạng thái hiển thị của riêng ô, không thuộc mô hình: nó không đổi
 * gì trong thứ được gửi đi, nên ở đây chứ không ở hook của màn.
 */

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

import { Input, type InputProps } from '@/components/ui/Input';

/* Nhập THEO TÊN, không default — lý do ở `recoveryShared.ts`. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

export type PasswordFieldProps = Omit<InputProps, 'type' | 'suffix'>;

export function PasswordField({ disabled, ...props }: PasswordFieldProps) {
  const [isVisible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      type={isVisible ? 'text' : 'password'}
      disabled={disabled}
      suffix={
        // `type="button"`: Enter hay bấm trên nút chỉ đổi hiện/ẩn, không bao giờ gửi biểu mẫu (BUG-011).
        <button
          type="button"
          disabled={disabled}
          aria-pressed={isVisible}
          aria-label={isVisible ? AUTH_MESSAGES.actions.hidePassword : AUTH_MESSAGES.actions.showPassword}
          onClick={() => {
            setVisible((visible) => !visible);
          }}
          // Vùng bấm 24 px, 44 px dưới 640, icon vẫn 16 px; `-mr-*` ăn vào lề khối suffix để icon gần như không dời (BUG-040).
          className="-mr-3 inline-flex h-11 w-11 items-center justify-center sm:-mr-1 sm:h-6 sm:w-6 text-text-muted transition-colors duration-120 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isVisible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      }
    />
  );
}
