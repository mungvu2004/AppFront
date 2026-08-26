/**
 * Khối "mật khẩu" của màn `/tai-khoan` — ba ô, một thanh sức mạnh, một cái nút.
 *
 * Đây là **cái nút duy nhất** của cả màn. Sáu khối còn lại tự lưu sau 800 ms
 * (A7); khối này thì không, và [CẤM TUYỆT ĐỐI] nói rõ vì sao — một mật khẩu gõ
 * dở nửa chừng mà bị gửi đi là một tài khoản khoá ngoài. Cấu trúc giữ lời hứa đó
 * chứ không phải trí nhớ: `useAccountAuth` không nhận `AccountDraftPort`, nên từ
 * file này không có đường nào dẫn tới bộ tự lưu.
 *
 * ## Hai trạng thái màn hình sống ở đây
 *
 * - **4 — lỗi.** Mật khẩu hiện tại sai thì câu lỗi buộc vào đúng ô đó, qua prop
 *   `error` của `Input`, không phải một dải cảnh báo trên đầu khối. Người dùng
 *   nhìn thấy chỗ phải sửa mà không phải đọc rồi tự tìm.
 * - **6 — không có quyền.** Tài khoản đăng nhập một lần thì cả khối thành chỉ
 *   đọc, kèm đúng câu "Do quản trị viên công ty quản lý." Không bày ba ô rồi
 *   khoá chúng lại: một biểu mẫu bày ra để không dùng được là một lời hứa rút
 *   lại ngay lúc vừa nói (cùng lẽ với `DangerZoneTab.tsx`).
 *
 * ## Thanh sức mạnh, và vì sao nó chỉ nhận một chữ
 *
 * Prop `strength` là **một mức**, không phải một con số ô đã tô. Bậc thang —
 * mức nào tô mấy ô, đọc thành chữ gì, lấy màu nào — nằm trong {@link STRENGTH_LADDER}
 * dưới đây, tức trong tầng vẽ, nơi quyết định về màu và về chữ vốn thuộc về. Còn
 * *mức* thì do `useAccountAuth` tính, từ đúng cái schema zod quyết định nút có
 * bấm được hay không, nên thanh và phép kiểm không có đường nào nói khác nhau.
 *
 * Ba màu trạng thái của A4 dùng đúng như tên chúng: hỏng, cần chú ý, đạt. A5
 * khoanh màu xanh "đã xác minh" cho việc người duyệt trên **đầu ra của AI**; một
 * mật khẩu người dùng vừa gõ không phải đầu ra của AI và không có người duyệt
 * nào ở đây, nên không có bất biến nào bị chạm.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `PasswordSection` và `PasswordSectionProps` — đã có nơi nhập
 *   theo, nên không đổi tên.
 * - Khung thẻ — nền `--bg-surface`, bo 12, đệm 20, tiêu đề `<h2>` — do
 *   `AccountSettings.tsx` vẽ sẵn. File này chỉ vẽ **ruột** của thẻ.
 * - View thuần: mọi thứ vào bằng props, không store, không mạng, không hẹn giờ
 *   của riêng nó. `local/no-data-layer-in-view` ép phần đó bằng cấu trúc.
 */

import type { FormEvent } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { FieldRow } from '@/components/ui/FieldRow';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

/** Ba mức của thanh sức mạnh. `null` khi ô mật khẩu mới còn trống. */
export type PasswordStrengthLevel = 'weak' | 'fair' | 'strong';

/**
 * Câu duy nhất của trạng thái 6, viết ra một lần.
 *
 * Xuất ra vì bộ kiểm của khối này đối chiếu đúng câu đó, và một câu chép hai lần
 * là một câu sẽ lệch.
 */
export const MANAGED_EXTERNALLY_REASON = 'Do quản trị viên công ty quản lý.';

/**
 * Bậc thang của thanh sức mạnh: mấy ô sáng, đọc thành chữ gì, lấy màu nào.
 *
 * Ba dòng, đúng ba mức. Thêm dòng thứ tư ở đây là thêm một màu trạng thái thứ
 * tư, thứ mà A4 tồn tại để chặn.
 */
const STRENGTH_LADDER: Readonly<
  Record<PasswordStrengthLevel, { readonly steps: number; readonly word: string; readonly tone: string }>
> = {
  weak: { steps: 1, word: 'yếu', tone: 'bg-state-violation' },
  fair: { steps: 2, word: 'khá', tone: 'bg-state-attention' },
  strong: { steps: 3, word: 'mạnh', tone: 'bg-state-verified' },
};

/** Ba ô của thanh. Cao 4px, và con số đó chỉ xuất hiện đúng ở đây. */
const STRENGTH_SLOTS: readonly number[] = [0, 1, 2];

export interface PasswordSectionProps {
  readonly currentPassword: string;
  readonly newPassword: string;
  readonly confirmPassword: string;
  readonly onCurrentPasswordChange: (value: string) => void;
  readonly onNewPasswordChange: (value: string) => void;
  readonly onConfirmPasswordChange: (value: string) => void;
  /** Trạng thái 4: câu lỗi buộc vào ô mật khẩu hiện tại. */
  readonly currentPasswordProblem: string | null;
  readonly newPasswordProblem: string | null;
  readonly confirmPasswordProblem: string | null;
  /** Mức sức mạnh của mật khẩu mới; `null` khi ô còn trống. */
  readonly strength: PasswordStrengthLevel | null;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
  readonly onSubmit: () => void;
  /** Trạng thái 5: câu báo lượt đổi đã xong; `null` khi chưa đổi lần nào. */
  readonly successMessage: string | null;
  /** Trạng thái 6: tài khoản đăng nhập một lần. */
  readonly isManagedExternally: boolean;
}

/** Thanh sức mạnh: ba ô cao 4px, và một câu chữ cho người không nhìn thấy màu. */
function StrengthMeter({ level }: { readonly level: PasswordStrengthLevel }) {
  const rung = STRENGTH_LADDER[level];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1" aria-hidden="true">
        {STRENGTH_SLOTS.map((slot) => (
          <span
            key={slot}
            className={cn(
              // `motion-reduce:transition-none` là nửa còn lại của lời hứa giảm
              // chuyển động: khối phiên tắt hoạt cảnh qua prop `reducedMotion`,
              // còn ô màu này tắt bằng chính CSS, vì nó không có prop nào.
              'h-[4px] flex-1 rounded-full transition-colors duration-180 motion-reduce:transition-none',
              slot < rung.steps ? rung.tone : 'bg-bg-sunken',
            )}
          />
        ))}
      </div>
      <p className="text-[12px] text-text-secondary">Độ mạnh: {rung.word}</p>
    </div>
  );
}

export function PasswordSection(props: PasswordSectionProps) {
  // Trạng thái 6. Đứng trước mọi thứ khác: khi công ty giữ mật khẩu thì màn này
  // không có ô nào để gõ, và cũng không có gì để kiểm.
  if (props.isManagedExternally) {
    return (
      <FieldRow label="mật khẩu" isReadOnly isLast>
        <div className="flex flex-col gap-1 py-1">
          <span className="text-[14px] text-text-primary">Đăng nhập một lần của công ty</span>
          <span className="text-[13px] text-text-secondary">{MANAGED_EXTERNALLY_REASON}</span>
        </div>
      </FieldRow>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // Bàn phím là đường đi hạng nhất (A12): Enter trong bất kỳ ô nào cũng gửi,
    // đúng như bấm nút, mà không cần nghe `keydown` ở đâu cả.
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <Input
        label="mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        value={props.currentPassword}
        onChange={(event) => props.onCurrentPasswordChange(event.target.value)}
        error={props.currentPasswordProblem}
        disabled={props.isSubmitting}
      />

      <div className="flex flex-col gap-2">
        <Input
          label="mật khẩu mới"
          type="password"
          autoComplete="new-password"
          value={props.newPassword}
          onChange={(event) => props.onNewPasswordChange(event.target.value)}
          error={props.newPasswordProblem}
          disabled={props.isSubmitting}
        />
        {props.strength === null ? null : <StrengthMeter level={props.strength} />}
      </div>

      <Input
        label="nhắc lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={props.confirmPassword}
        onChange={(event) => props.onConfirmPasswordChange(event.target.value)}
        error={props.confirmPasswordProblem}
        disabled={props.isSubmitting}
      />

      {props.successMessage === null ? null : (
        <InlineAlert level="verified" message={props.successMessage} />
      )}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!props.canSubmit} loading={props.isSubmitting}>
          Đổi mật khẩu
        </Button>
      </div>
    </form>
  );
}
