/**
 * Màn `/tai-khoan` — cài đặt tài khoản (S-05, bản Z vòng 9 đã duyệt).
 *
 * Hình dạng theo mẫu M5 Cài đặt: **mục lục trái dính** + mỗi phần MỘT khung
 * `Section` (NGUYEN-TAC-BO-CUC §2), khối nội dung tối đa 1280 căn giữa. Mật khẩu
 * đứng thứ hai, là mục riêng: không tự lưu, có nút xác nhận riêng trong
 * `PasswordSection`. Ba câu của màn nằm ở `PageHead`: làm gì (H1 động từ +
 * đối tượng), trạng thái (chip tự lưu + câu có số + chỉ báo lưu), bước tiếp
 * (nút về Dự án).
 *
 * ## Mục D: đây là view thuần
 *
 * Một prop, `vm`. Không store, không mạng, không `Date`. Ranh giới lỗi nằm ở
 * `AccountSettings.container.tsx`. File này vẽ **khung** (mục lục, khung phần,
 * `<h2>` mang id làm neo cho BUG-178); bảy component khối vẽ **ruột** và nhận
 * nguyên đối tượng props của mình.
 *
 * ## Trạng thái 2 là của trang, không của khối
 *
 * `vm.isLoading` biến mọi khung thành khung xương một lần, để các khối không
 * nhấp nháy lệch nhịp. Sáu trạng thái còn lại nằm trong ruột của khối (bảng
 * chia ở `useAccountSettings.ts`).
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Keyboard, Lock, MonitorSmartphone, SlidersHorizontal, Trash2, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { SaveIndicator } from '@/components/feedback/SaveIndicator';
import { Skeleton } from '@/components/feedback/Skeleton';
import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Badge } from '@/components/ui/Badge';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import viMessages from '@/i18n/vi.json';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/routes/paths';

import { AppearanceSection } from './AppearanceSection';
import { DangerZone } from './DangerZone';
import { NotificationsSection } from './NotificationsSection';
import { PasswordSection } from './PasswordSection';
import { ProfileSection, type ProfileSectionProps } from './ProfileSection';
import { SessionsSection } from './SessionsSection';
import { ShortcutsSection } from './ShortcutsSection';
import type { AccountSettingsViewModel } from './useAccountSettings';

/** Lớp vòng tiêu điểm chung cho liên kết trên nền khung. */
const FOCUS_RING =
  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

/** Năm trường hồ sơ đếm cho câu trạng thái "Hồ sơ đã điền n/5 mục" (GHI-CHU: tính ở FE). */
const PROFILE_FIELDS: readonly (readonly ['fullName' | 'jobTitle' | 'email' | 'phone' | 'language', string])[] = [
  ['fullName', 'họ tên'],
  ['jobTitle', 'chức danh'],
  ['email', 'thư điện tử'],
  ['phone', 'điện thoại'],
  ['language', 'ngôn ngữ'],
];

/** Câu trạng thái có số của trang: đã điền bao nhiêu mục hồ sơ, còn thiếu mục nào. */
function profileStatusSentence(profile: ProfileSectionProps): string {
  const total = PROFILE_FIELDS.length;
  const missing = PROFILE_FIELDS.filter(([key]) => profile[key].trim() === '').map(([, label]) => label);

  if (missing.length === 0) {
    return `Hồ sơ đã điền đủ ${total} mục`;
  }

  const last = missing[missing.length - 1];
  const rest = missing.slice(0, -1);
  const list = rest.length === 0 ? last : `${rest.join(', ')} và ${last}`;

  return `Hồ sơ đã điền ${total - missing.length}/${total} mục, còn ${list}`;
}

interface TocEntry {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Ghi chú nhỏ bên phải mục (ẩn dưới 1280). */
  readonly note?: string;
}

interface AccountBlockProps {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly isLoading: boolean;
  readonly tone?: 'danger';
  readonly children: ReactNode;
}

/**
 * Một phần của trang, kể cả lúc đang tải.
 *
 * Dùng khung `Section` nhưng tự vẽ đầu khung: `<h2>` phải mang `id` để neo
 * `/tai-khoan#account-…` đặt tiêu điểm đúng vào tiêu đề (BUG-178), mà `Section`
 * chưa có chỗ truyền id cho tiêu đề.
 */
function AccountBlock({ id, title, description, isLoading, tone, children }: AccountBlockProps) {
  return (
    <Section flush aria-labelledby={id} aria-busy={isLoading ? true : undefined} className="scroll-mt-6">
      <div className="flex min-h-14 items-center gap-3 border-b border-border-default px-5 py-4">
        <h2
          id={id}
          className={cn(
            'whitespace-nowrap text-heading',
            tone === 'danger' ? 'text-state-violation-text' : 'text-text-primary',
          )}
        >
          {title}
        </h2>
        <p className="ml-auto hidden truncate text-[13px] text-text-secondary xl:block">{description}</p>
      </div>
      <div className="px-5 py-4">{isLoading ? <Skeleton preset="property-panel" /> : children}</div>
    </Section>
  );
}

/** Mục lục trái: một khung, dính khi cuộn. */
function AccountToc({ entries, danger }: { readonly entries: readonly TocEntry[]; readonly danger: TocEntry | null }) {
  const renderEntry = ({ id, label, icon: Icon, note }: TocEntry) => (
    <a
      key={id}
      href={`#${id}`}
      className={cn(
        'flex h-10 items-center gap-2 rounded-md px-3 text-[14px] text-text-primary hover:bg-bg-hover',
        FOCUS_RING,
      )}
    >
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
      {label}
      {note === undefined ? null : (
        <span className="ml-auto hidden text-[12px] text-text-secondary xl:inline">{note}</span>
      )}
    </a>
  );

  return (
    <nav
      aria-label="Mục trong trang"
      className="sticky top-6 flex flex-col rounded-xl bg-bg-surface p-2 shadow-panel"
    >
      {entries.map(renderEntry)}
      {danger === null ? null : (
        <>
          <hr className="mx-1 my-2 border-0 border-t border-border-default" />
          {renderEntry(danger)}
        </>
      )}
    </nav>
  );
}

export interface AccountSettingsProps {
  readonly vm: AccountSettingsViewModel;
}

/** Màn cài đặt tài khoản như một hàm của props — test và story dựng thẳng cái này. */
export function AccountSettings({ vm }: AccountSettingsProps) {
  const isLoading = vm.isLoading;
  const profile = vm.preferences.profile;
  const fullName = profile.fullName.trim();

  const tocEntries: TocEntry[] = [
    { id: 'account-profile', label: 'Hồ sơ', icon: User },
    { id: 'account-password', label: 'Mật khẩu', icon: Lock, note: 'Lưu riêng' },
    { id: 'account-appearance', label: 'Giao diện', icon: SlidersHorizontal },
    { id: 'account-notifications', label: 'Thông báo', icon: Bell },
    { id: 'account-shortcuts', label: 'Phím tắt', icon: Keyboard },
  ];
  if (vm.auth.sessions !== null) {
    tocEntries.push({ id: 'account-sessions', label: 'Phiên đăng nhập', icon: MonitorSmartphone });
  }
  const dangerEntry: TocEntry | null =
    vm.auth.danger === null ? null : { id: 'account-danger', label: 'Xoá tài khoản', icon: Trash2 };

  return (
    <div className="min-h-screen bg-bg-app">
      <div className="mx-auto w-full max-w-[1344px] px-8 pb-12 pt-6">
        <PageHead
          eyebrow={fullName === '' ? 'Tài khoản' : `Tài khoản ${fullName}`}
          title="Đổi thông tin và tuỳ chọn tài khoản"
          status={
            // A7: không có nút lưu, nên trạng thái lưu nằm ở câu thứ hai của đầu trang. Lỗi tải
            // thì chưa có gì để lưu: không hiện chỉ báo cạnh banner lỗi (BUG-504).
            vm.errorMessage === null ? (
              <>
                {isLoading ? null : (
                  <>
                    <Badge variant="verified">Tự lưu khi bạn sửa</Badge>
                    <span>{profileStatusSentence(profile)}</span>
                  </>
                )}
                <SaveIndicator saveState={vm.saveState} label={vm.saveLabel} />
              </>
            ) : null
          }
          next={
            // 33P-A-010: lối ra khỏi trang. Route này nằm ngoài khung ứng dụng nên không có gì khác dẫn về.
            <Link to={ROUTES.dashboard} className={getButtonStyles({ variant: 'secondary' })}>
              {viMessages.account.backToDashboard}
            </Link>
          }
        />

        {vm.errorMessage === null ? (
          <div className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-5 xl:grid-cols-[240px_minmax(0,1fr)] xl:gap-6">
            <AccountToc entries={tocEntries} danger={dangerEntry} />

            <div className="flex min-w-0 flex-col gap-4">
              <AccountBlock
                id="account-profile"
                title="Hồ sơ"
                description="Tên và liên hệ hiện cho thành viên cùng dự án"
                isLoading={isLoading}
              >
                <ProfileSection {...profile} />
              </AccountBlock>

              <AccountBlock
                id="account-password"
                title="Mật khẩu"
                description="Không tự lưu, đổi bằng nút riêng"
                isLoading={isLoading}
              >
                <PasswordSection {...vm.auth.password} />
              </AccountBlock>

              <AccountBlock
                id="account-appearance"
                title="Giao diện"
                description="Áp dụng ngay cho mọi màn"
                isLoading={isLoading}
              >
                <AppearanceSection {...vm.preferences.appearance} />
              </AccountBlock>

              <AccountBlock
                id="account-notifications"
                title="Thông báo"
                description="Việc nào báo trong ứng dụng, việc nào gửi thư"
                isLoading={isLoading}
              >
                <NotificationsSection {...vm.tables.notifications} />
              </AccountBlock>

              <AccountBlock
                id="account-shortcuts"
                title="Phím tắt"
                description="Sinh từ danh sách phím của ứng dụng, chỉ đọc"
                isLoading={isLoading}
              >
                <ShortcutsSection {...vm.tables.shortcuts} />
                {/* N0-03: màn chào chỉ tự hiện một lần; đây là lối mở lại nó. */}
                <Link
                  to={`${ROUTES.onboarding}?again=1`}
                  className={cn(
                    'mt-4 inline-block w-fit rounded-sm text-[13px] text-text-secondary underline hover:text-text-primary',
                    FOCUS_RING,
                  )}
                >
                  Xem lại hướng dẫn bắt đầu
                </Link>
              </AccountBlock>

              {/* Năng lực tắt thì khối RỜI KHỎI DOM, không vô hiệu hoá (khuôn `exportPanelGateway.ts`). */}
              {vm.auth.sessions === null ? null : (
                <AccountBlock
                  id="account-sessions"
                  title="Phiên đăng nhập"
                  description="Những máy đang đăng nhập vào tài khoản này"
                  isLoading={isLoading}
                >
                  <SessionsSection {...vm.auth.sessions} />
                </AccountBlock>
              )}

              {vm.auth.danger === null ? null : (
                <AccountBlock
                  id="account-danger"
                  title="Xoá tài khoản"
                  description="Xoá vĩnh viễn, phải gõ đúng thư điện tử để xác nhận"
                  isLoading={isLoading}
                  tone="danger"
                >
                  <DangerZone {...vm.auth.danger} />
                </AccountBlock>
              )}
            </div>
          </div>
        ) : (
          // A11: lỗi đọc cấp trang thay chỗ các khối, vì khi ấy không khối nào có
          // dữ liệu để vẽ. Màn trắng là thất bại duy nhất A11 tồn tại để chặn.
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
