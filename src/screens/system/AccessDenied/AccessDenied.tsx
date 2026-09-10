/**
 * `AccessDenied` — view thuần của màn "bạn chưa có quyền truy cập" (S-44). Mọi
 * chuỗi tiếng Việt và mọi con số đã thành chữ đến từ `AccessDeniedVm`
 * (`accessDeniedModel.ts`, hợp đồng đông lạnh); file này chỉ in ra (A15).
 * Không store, không mạng, không `src/api`, không `src/domain` — test được chỉ
 * từ props (mục D, R-60).
 *
 * **Bố cục.** Một cột rộng {@link CONTENT_COLUMN_PX}, căn giữa cả ngang lẫn
 * dọc, nền `--bg-app` — cùng lối trình bày S-43 (`NotFound.tsx`), vì hai màn
 * này là cùng một loại tình huống: người dùng đến một chỗ họ chưa đi tiếp
 * được, và việc của màn là chỉ ra bước kế tiếp chứ không phải kể tội.
 *
 * **Có tắt ⇒ khối RỜI KHỎI DOM.** Bốn cờ của {@link AccessDeniedCapabilities}
 * hôm nay đều `false` vì tầng logic tương ứng chưa tồn tại (xem docblock của
 * `accessDeniedModel.ts`). Khối của một cờ tắt không được render rồi `disabled`,
 * không `hidden`, không `display:none`: một nút bấm không làm gì là lời hứa
 * suông, và người dùng không có cách nào biết nó suông. Khuôn đã có trong repo
 * là `CollaborationLayer.tsx` — `canRequestAccess === false` thì nút biến mất
 * hẳn. Hai hành động `requestAccess` / `submitLinkPassword` `null` **cùng lúc**
 * với cờ của chúng, nên điều kiện dựng ở đây đọc cả hai và chúng không bao giờ
 * nói hai điều khác nhau.
 *
 * **Không một pixel nào đỏ.** Không biến thể cảnh báo của bất kỳ component nào,
 * không token màu vi phạm, không biểu tượng khoá tô đỏ.
 * Chưa có quyền không phải là lỗi của người đang đọc màn này. Huy hiệu trạng
 * thái dùng `variant="neutral"` — `neutral` là màu trung tính có sẵn của
 * `Badge`, không phải màu trạng thái thứ tư mà A4 tồn tại để chặn.
 *
 * **Không tiết lộ khi chưa có quyền.** Màn này không tự ghép tên dự án ở đâu
 * cả: `restrictionSentence` đã tính sẵn `canNameProject` ở viewmodel, nên chỗ
 * duy nhất quyết định "được nói tên hay không" là cổng năng lực, không phải
 * một nhánh `if` nằm rải trong JSX.
 */

import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { cn } from '@/lib/utils';

import { AccessDeniedPlan } from './AccessDeniedPlan';
import type { AccessDeniedVm } from './accessDeniedModel';

/**
 * Bề ngang cột nội dung, đúng con số S-43 dùng (`notFoundModel.ts`
 * `CONTENT_COLUMN_PX`). Khai cục bộ ở đây thay vì nhập từ thư mục màn khác:
 * hai màn giống nhau về bố cục hôm nay không phải là một lời hứa rằng chúng sẽ
 * còn giống nhau, và một `import` xuyên thư mục màn biến sự trùng hợp ấy thành
 * ràng buộc. Hằng CÓ TÊN, sống trong thư mục màn — cùng khuôn
 * `REQUEST_COOLDOWN_MS` của hợp đồng.
 */
const CONTENT_COLUMN_PX = 560;

const SWAP_ANIMATION_NAME = 'ad-request-swap';

/**
 * Khối xin quyền đổi sang xác nhận trong `standard` (260ms).
 *
 * Đặc tả S-44 viết 240ms; thang chuyển động của repo có đúng năm giá trị
 * 120/180/260/340/700 và 240 không nằm trong đó (mục B, `local/no-raw-duration`).
 * Hợp đồng đã chốt 260 — giá trị gần nhất trong thang — và đây là chỗ nó chạy.
 *
 * `tailwind.config.ts` bị khoá ngoài danh sách trắng của lượt này nên
 * `@keyframes` khai ngay tại nơi dùng, cùng cách `NotFound.tsx` đã làm.
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

/** Khối phụ có viền, dùng chung cho khối chủ dự án / xin quyền / mật khẩu. */
const PANEL_CLASS =
  'flex w-full flex-col gap-3 rounded-lg border border-border-default bg-bg-surface p-4 text-left';

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
  // Cờ và hành động `null` cùng lúc (hợp đồng), nên đọc cả hai không thừa: nó
  // là thứ khiến TypeScript và người đọc cùng thấy khối này không thể xuất hiện
  // với một cái nút rỗng bên trong.
  const showRequestPanel =
    capabilities.canRequestAccess && (request !== null || requestAccess !== null);
  const showPasswordPanel = capabilities.canSubmitLinkPassword && submitLinkPassword !== null;
  const showOwnerPanel = capabilities.canShowOwner && owner !== null;

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-bg-app px-6 py-16">
      <style>{STYLE_TEXT}</style>
      <div
        className={cn('flex flex-col items-center text-center', isCompact ? 'gap-4' : 'gap-6')}
        style={{ width: CONTENT_COLUMN_PX }}
      >
        {!isCompact && <AccessDeniedPlan />}

        <h2 className="text-[20px] font-semibold text-text-primary">{title}</h2>
        <p className="text-[14px] leading-relaxed text-text-secondary">{restrictionSentence}</p>
        <p className="text-[14px] leading-relaxed text-text-secondary">{reasonSentence}</p>

        {/* Ai cấp được quyền — luôn hiện. Một màn chặn đường mà không nói ra
            bước kế tiếp thì chỉ là một ngõ cụt lịch sự. */}
        <p className="text-[14px] leading-relaxed text-text-primary">{whoCanGrantSentence}</p>

        {/* Danh tính: nhãn luôn đọc thành câu, kể cả khi phiên không mang email
            — chỗ trống chứ không phải chữ "undefined", và không bịa ra một địa
            chỉ nào. */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] text-text-secondary">
          <span>{identityLabel}</span>
          {currentEmail !== null && <span className="font-medium text-text-primary">{currentEmail}</span>}
          <Button variant="ghost" size="sm" onClick={switchAccount.onActivate}>
            {switchAccount.label}
          </Button>
        </div>

        {showOwnerPanel && (
          <div className={cn(PANEL_CLASS, 'flex-row items-center gap-3')}>
            {/* CHỈ `alt`, không `initials` — đã chạy thử, không suy luận.
                `Avatar` VẼ chữ tắt ra màn hình, mà `expectVietnamese` bỏ hoa
                thường trước khi so, nên không cách viết nào của chữ tắt sống
                sót được phép kiểm ("Tr" trượt y hệt "tr"). Cùng kết luận
                `HistoryItemAvatar` đã ghi lại sau một lần chạy thật. Vòng tròn
                để trống, `alt` — tên người, tiếng Việt — mang danh tính. */}
            <Avatar
              alt={owner.name}
              {...(owner.avatarUrl === undefined ? {} : { src: owner.avatarUrl })}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[14px] font-medium text-text-primary">
                {owner.name}
              </span>
              <span className="truncate text-[13px] text-text-secondary">{owner.email}</span>
            </div>
          </div>
        )}

        {showRequestPanel && (
          <div className={PANEL_CLASS}>
            {request !== null ? (
              <div className={cn('flex flex-col gap-2', SWAP_ANIMATION_NAME)}>
                <Badge variant="neutral">đã gửi yêu cầu</Badge>
                <span className="text-[13px] text-text-secondary">{request.sentAtLabel}</span>
                {request.declineMessage !== undefined && (
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    {request.declineMessage}
                  </p>
                )}
              </div>
            ) : (
              requestAccess !== null && (
                <>
                  <Textarea label="Lý do bạn cần truy cập (không bắt buộc)" rows={2} />
                  <Button variant="primary" onClick={requestAccess.onActivate}>
                    {requestAccess.label}
                  </Button>
                </>
              )
            )}

            {throttleSentence !== null && (
              <p className="text-[12px] not-italic leading-relaxed text-text-muted">
                {throttleSentence}
              </p>
            )}
          </div>
        )}

        {showPasswordPanel && (
          <div className={PANEL_CLASS}>
            <Input label="Mật khẩu liên kết" type="password" autoComplete="current-password" />
            <Button variant="secondary" onClick={submitLinkPassword.onActivate}>
              {submitLinkPassword.label}
            </Button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="ghost" onClick={backToProjects.onActivate}>
            {backToProjects.label}
          </Button>
          {enterProject !== null && (
            <Button variant="primary" onClick={enterProject.onActivate}>
              {enterProject.label}
            </Button>
          )}
        </div>

        <p className="select-text text-[12px] font-normal not-italic text-text-muted">
          {errorCodeCaption}
        </p>
      </div>
    </div>
  );
}
