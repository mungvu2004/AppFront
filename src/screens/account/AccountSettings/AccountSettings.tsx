/**
 * Màn `/tai-khoan` — cài đặt tài khoản. Sáu khối bề mặt cộng một vùng nguy hiểm.
 *
 * Người vào đây hiếm khi vào, và thường chỉ để đổi cách nhận thông báo hoặc tra
 * đúng một phím tắt. Nên hình dạng của trang là thứ đơn giản nhất tìm được:
 * **một cột, rộng 720**, bảy thẻ trên nền `--bg-surface`, bo 12, đệm 20, cách
 * nhau 24. Không thẻ tab, không thanh bên, không thứ tự phải nhớ. Chỉ báo lưu
 * nằm ở đầu trang vì A7 nói màn này **không có nút lưu** và người dùng phải
 * nhìn thấy điều đó trước khi họ kịp đi tìm cái nút.
 *
 * ## Mục D: đây là view thuần
 *
 * Một prop, `vm`. Không store, không mạng, không `Date`, không một phép định
 * dạng số nào cho `local/no-raw-number` bắt được. `local/no-data-layer-in-view`
 * ép phần đó bằng cấu trúc chứ không bằng lời hứa. Ranh giới lỗi nằm ở
 * `AccountSettings.container.tsx`, cùng khuôn `src/App.tsx` đang gắn.
 *
 * ## Ai vẽ khung, ai vẽ ruột
 *
 * File này vẽ **khung**: thẻ, tiêu đề `<h2>`, câu mô tả một dòng, và trạng thái
 * 2 của cả trang. Bảy component khối vẽ **ruột**, và mỗi component thuộc về một
 * người dựng khác (xem `index.ts`). File này không đọc vào bên trong props của
 * khối nào — nó chuyển nguyên cả đối tượng xuống — nên một khối mọc thêm trường
 * không bao giờ làm file này phải sửa theo.
 *
 * ## Trạng thái 2 là của trang, không của khối
 *
 * `vm.isLoading` biến cả bảy thẻ thành khung xương một lần. Bảy khối tự vẽ khung
 * xương của riêng mình thì màn hình nhấp nháy bảy nhịp lệch nhau. Sáu trạng thái
 * còn lại nằm trong ruột của khối, và bảng chia chúng nằm ở
 * `useAccountSettings.ts`.
 */

import type { ReactNode } from 'react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { SaveIndicator } from '@/components/feedback/SaveIndicator';
import { Skeleton } from '@/components/feedback/Skeleton';

import { AppearanceSection } from './AppearanceSection';
import { DangerZone } from './DangerZone';
import { NotificationsSection } from './NotificationsSection';
import { PasswordSection } from './PasswordSection';
import { ProfileSection } from './ProfileSection';
import { SessionsSection } from './SessionsSection';
import { ShortcutsSection } from './ShortcutsSection';
import type { AccountSettingsViewModel } from './useAccountSettings';

/**
 * Khung của một thẻ: nền, bo 12, đệm 20.
 *
 * Đây là quyết định xếp chỗ của riêng màn này, không phải một component chung
 * mới — cùng lý do `ProjectSettings.tsx` giữ cách xếp thu gọn ở trong nhà nó
 * (R-68). Bảy lần lặp lại đoạn `className` này thì lần thứ tám sẽ lệch, nên nó
 * là một hằng, và hằng thì không xuất ra khỏi file.
 */
const BLOCK_CLASS = 'flex flex-col gap-3 rounded-[12px] bg-bg-surface p-5';

/** Vùng nguy hiểm mang thêm viền, để mắt phân biệt được trước khi kịp đọc chữ. */
const DANGER_BLOCK_CLASS = `${BLOCK_CLASS} border border-danger-border`;

interface AccountBlockProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly isLoading: boolean;
  readonly tone?: 'danger';
  readonly children: ReactNode;
}

/**
 * Một thẻ, kể cả lúc đang tải.
 *
 * Không xuất ra ngoài: nó không phải component dùng chung, nó là cách màn này
 * lặp lại chính nó bảy lần mà không lệch.
 */
function AccountBlock({ id, title, description, isLoading, tone, children }: AccountBlockProps) {
  return (
    <section
      aria-labelledby={id}
      className={tone === 'danger' ? DANGER_BLOCK_CLASS : BLOCK_CLASS}
    >
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-[15px] font-semibold text-text-primary">
          {title}
        </h2>
        <p className="text-[13px] text-text-secondary">{description}</p>
      </div>
      {isLoading ? <Skeleton preset="property-panel" /> : children}
    </section>
  );
}

export interface AccountSettingsProps {
  readonly vm: AccountSettingsViewModel;
}

/** Màn cài đặt tài khoản như một hàm của props — test và story dựng thẳng cái này. */
export function AccountSettings({ vm }: AccountSettingsProps) {
  const isLoading = vm.isLoading;

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6 p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[20px] font-semibold text-text-primary">cài đặt tài khoản</h1>
            <p className="text-[13px] text-text-secondary">
              Hồ sơ, giao diện, thông báo, phím tắt, mật khẩu và những phiên đang mở.
            </p>
          </div>
          {/* A7: không có nút lưu, nên chỉ báo lưu phải nằm ở chỗ mắt tìm cái nút. */}
          <SaveIndicator saveState={vm.saveState} label={vm.saveLabel} />
        </header>

        {vm.errorMessage === null ? (
          <>
            <AccountBlock
              id="account-profile"
              title="hồ sơ"
              description="Tên, ảnh đại diện và thông tin liên hệ."
              isLoading={isLoading}
            >
              <ProfileSection {...vm.preferences.profile} />
            </AccountBlock>

            <AccountBlock
              id="account-appearance"
              title="giao diện"
              description="Chủ đề sáng, tối, hoặc theo hệ thống."
              isLoading={isLoading}
            >
              <AppearanceSection {...vm.preferences.appearance} />
            </AccountBlock>

            <AccountBlock
              id="account-notifications"
              title="thông báo"
              description="Việc nào báo qua thư điện tử, việc nào báo trong ứng dụng."
              isLoading={isLoading}
            >
              <NotificationsSection {...vm.tables.notifications} />
            </AccountBlock>

            <AccountBlock
              id="account-shortcuts"
              title="phím tắt"
              description="Những phím tắt đang có hiệu lực trong ứng dụng."
              isLoading={isLoading}
            >
              <ShortcutsSection {...vm.tables.shortcuts} />
            </AccountBlock>

            <AccountBlock
              id="account-password"
              title="mật khẩu"
              description="Đổi mật khẩu đăng nhập."
              isLoading={isLoading}
            >
              <PasswordSection {...vm.auth.password} />
            </AccountBlock>

            <AccountBlock
              id="account-sessions"
              title="phiên đăng nhập"
              description="Những máy đang đăng nhập vào tài khoản này."
              isLoading={isLoading}
            >
              <SessionsSection {...vm.auth.sessions} />
            </AccountBlock>

            <AccountBlock
              id="account-danger"
              title="vùng nguy hiểm"
              description="Những việc không hoàn tác được."
              isLoading={isLoading}
              tone="danger"
            >
              <DangerZone {...vm.auth.danger} />
            </AccountBlock>
          </>
        ) : (
          // A11: lỗi đọc cấp trang thay chỗ bảy khối, vì khi ấy không khối nào
          // có dữ liệu để vẽ. Màn trắng là thất bại duy nhất A11 tồn tại để chặn.
          <InlineAlert
            level="violation"
            title="Không tải được cài đặt tài khoản"
            message={vm.errorMessage}
            action={{ label: 'Thử lại', onClick: vm.retryLoad, variant: 'secondary' }}
          />
        )}
      </div>
    </div>
  );
}
