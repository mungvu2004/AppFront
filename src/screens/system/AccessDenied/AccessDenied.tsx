/**
 * `AccessDenied` — view thuần của màn "Bạn chưa có quyền truy cập" (S-44). Chữ
 * của nút, tiêu đề, câu lý do, danh tính và mã lỗi đến từ `AccessDeniedVm`
 * (`accessDeniedModel.ts`); file này chỉ thêm nhãn trình bày cố định (eyebrow,
 * chip theo `reason`, tiêu đề khung). Không store, không mạng, không `src/api`,
 * không `src/domain` — test được chỉ từ props (mục D, R-60).
 *
 * **Bố cục (demo Z/S-44, vòng 6).** Cùng khung một cột 720 với S-43:
 * `PageHead` (eyebrow + H1, chip trung tính + câu giới hạn), dòng lý do + ai
 * cấp được quyền, rồi các khung `Section`: "Kiểm tra tài khoản đang dùng" (luôn
 * có — nguyên nhân hay gặp nhất là nhầm tài khoản), "Xin quyền từ chủ dự án"
 * và "Mật khẩu liên kết" (chỉ khi cờ năng lực bật), cuối cùng hàng lối ra + mã
 * lỗi chọn được.
 *
 * **Có tắt ⇒ khối RỜI KHỎI DOM.** Bốn cờ của `AccessDeniedCapabilities` hôm nay
 * đều `false` (CẦN BE: T-05 xin quyền, chủ dự án, tên dự án, mật khẩu liên
 * kết). Khối của một cờ tắt không render rồi `disabled` — nút không làm gì là
 * lời hứa suông. Khi khung xin quyền vắng, "Về danh sách dự án của tôi" là nút
 * chính duy nhất.
 *
 * **Không một pixel nào đỏ, không ảnh dự án.** Chip `variant="neutral"`; một
 * ảnh bản vẽ, dù làm mờ, cũng là lộ dữ liệu khi chưa có quyền.
 */

import { Clock3 } from 'lucide-react';

import { PageHead } from '@/components/shell/PageHead';
import { Section } from '@/components/shell/Section';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { initialsOf } from '@/lib/format/initials';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

import type { AccessDeniedVm } from './accessDeniedModel';

const SWAP_ANIMATION_NAME = 'ad-request-swap';

/**
 * Khối xin quyền đổi sang xác nhận trong `standard` (260ms) — giá trị gần 240
 * của đặc tả nhất trong thang 120/180/260/340/700 (`local/no-raw-duration`).
 */
const STYLE_TEXT = `
  @keyframes ${SWAP_ANIMATION_NAME} {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .${SWAP_ANIMATION_NAME} {
    animation: ${SWAP_ANIMATION_NAME} ${MOTION_DURATIONS_MS.standard}ms ease-out forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .${SWAP_ANIMATION_NAME} {
      animation: none;
    }
  }
`;

const EYEBROW = 'Đường dẫn tới một dự án';
const ACCOUNT_HEADING = 'Kiểm tra tài khoản đang dùng';
const ACCOUNT_HINT = 'Nếu đồng nghiệp mời bạn bằng địa chỉ khác, hãy vào bằng địa chỉ đó';
const REQUEST_HEADING = 'Xin quyền từ chủ dự án';
const REQUEST_SENT_BADGE = 'Đã gửi yêu cầu';
const PASSWORD_HEADING = 'Mở bằng mật khẩu liên kết';

/** Hàng người: vòng chữ tắt + tên/email + một nút bên phải. */
const WHO_ROW_CLASS = 'flex items-center gap-3';

export function AccessDenied({
  capabilities,
  title,
  restrictionSentence,
  reasonSentence,
  whoCanGrantSentence,
  currentEmail,
  identityLabel,
  switchAccount,
  owner,
  request,
  throttleSentence,
  requestAccess,
  submitLinkPassword,
  backToProjects,
  enterProject,
  errorCodeCaption,
  isCompact,
}: AccessDeniedVm) {
  // Cờ và hành động `null` cùng lúc (hợp đồng), nên đọc cả hai không thừa.
  const showRequestPanel =
    capabilities.canRequestAccess && (request !== null || requestAccess !== null);
  const showPasswordPanel = capabilities.canSubmitLinkPassword && submitLinkPassword !== null;
  const showOwnerPanel = capabilities.canShowOwner && owner !== null;
  const showRequestSection = showRequestPanel || showOwnerPanel;
  // Một nút chính mỗi màn: nút gửi yêu cầu hoặc "Mở dự án" giữ vai chính khi có.
  const backIsPrimary = enterProject === null && !(showRequestPanel && requestAccess !== null && request === null);

  return (
    <div className="min-h-full w-full bg-bg-app">
      <style>{STYLE_TEXT}</style>
      <div className={cn('mx-auto box-content max-w-[720px] px-8 pb-12', isCompact ? 'pt-12' : 'pt-[72px]')}>
        <PageHead
          className="mb-0"
          eyebrow={EYEBROW}
          title={title}
          status={
            <>
              <span>{restrictionSentence}</span>
            </>
          }
        />
        <p className="mt-3 max-w-[600px] text-[14px] leading-[22px] text-text-secondary">
          {reasonSentence} {whoCanGrantSentence}
        </p>

        <div className="mt-6 grid gap-4">
          <Section title={ACCOUNT_HEADING}>
            <div className={WHO_ROW_CLASS}>
              {currentEmail !== null && (
                <span
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg-sunken text-[14px] font-medium text-text-primary"
                  aria-hidden="true"
                >
                  {initialsOf('', currentEmail)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium leading-5 text-text-primary">
                  <span>{identityLabel}</span>
                  {currentEmail !== null && <> <span className="whitespace-nowrap">{currentEmail}</span></>}
                </p>
                {currentEmail !== null && (
                  <p className="mt-0.5 text-[13px] leading-[18px] text-text-secondary">{ACCOUNT_HINT}</p>
                )}
              </div>
              <Button variant="secondary" className="shrink-0" onClick={switchAccount.onActivate}>
                {switchAccount.label}
              </Button>
            </div>
          </Section>

          {showRequestSection && (
            <Section title={REQUEST_HEADING}>
              <div className="flex flex-col gap-4">
                {showOwnerPanel && (
                  <div className={WHO_ROW_CLASS}>
                    <Avatar
                      alt={owner.name}
                      initials={initialsOf(owner.name, owner.email)}
                      {...(owner.avatarUrl === undefined ? {} : { src: owner.avatarUrl })}
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-medium text-text-primary">{owner.name}</span>
                      <span className="truncate text-[13px] text-text-secondary">{owner.email}</span>
                    </div>
                  </div>
                )}

                {showRequestPanel && request !== null && (
                  <div
                    role="status"
                    className={cn('flex flex-col gap-2 rounded-lg bg-bg-sunken p-4', SWAP_ANIMATION_NAME)}
                  >
                    <Badge variant="neutral" noDot className="gap-1.5 self-start bg-bg-surface">
                      <Clock3 size={14} aria-hidden="true" />
                      {REQUEST_SENT_BADGE}
                    </Badge>
                    <span className="text-[14px] leading-[22px] text-text-primary">{request.sentAtLabel}</span>
                    {request.declineMessage !== undefined && (
                      <p className="text-[13px] leading-relaxed text-text-secondary">{request.declineMessage}</p>
                    )}
                  </div>
                )}

                {showRequestPanel && request === null && requestAccess !== null && (
                  <Textarea label="Lý do bạn cần truy cập (không bắt buộc)" rows={2} />
                )}

                {showRequestPanel && (throttleSentence !== null || (request === null && requestAccess !== null)) && (
                  <div className="flex items-center gap-4">
                    {throttleSentence !== null && (
                      <p className="text-[13px] leading-[18px] text-text-secondary">{throttleSentence}</p>
                    )}
                    {request === null && requestAccess !== null && (
                      <Button variant="primary" className="ml-auto shrink-0" onClick={requestAccess.onActivate}>
                        {requestAccess.label}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {showPasswordPanel && (
            <Section title={PASSWORD_HEADING}>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input label="Mật khẩu liên kết" type="password" autoComplete="current-password" />
                </div>
                <Button variant="secondary" onClick={submitLinkPassword.onActivate}>
                  {submitLinkPassword.label}
                </Button>
              </div>
            </Section>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button variant={backIsPrimary ? 'primary' : 'ghost'} onClick={backToProjects.onActivate}>
            {backToProjects.label}
          </Button>
          {enterProject !== null && (
            <Button variant="primary" onClick={enterProject.onActivate}>
              {enterProject.label}
            </Button>
          )}
          <samp className="ml-auto select-all rounded bg-bg-sunken px-1.5 py-0.5 font-mono text-[12px] text-text-secondary">
            {errorCodeCaption}
          </samp>
        </div>
      </div>
    </div>
  );
}
