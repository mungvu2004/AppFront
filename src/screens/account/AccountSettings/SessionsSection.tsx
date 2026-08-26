/**
 * Khối "phiên đăng nhập" của màn `/tai-khoan` — thiết bị, vị trí, hoạt động cuối.
 *
 * ## Nửa của trạng thái 3 thuộc về khối này
 *
 * Đọc danh sách phiên hỏng thì dải cảnh báo nằm **trong khối này**, không bao
 * giờ thành dải cảnh báo của cả trang. Đó là toàn bộ ý nghĩa của "một phần":
 * sáu khối kia vẫn đọc được, vẫn sửa được, và một lượt đọc hỏng ở đây không được
 * phép nói thay cho chúng. Lỗi đọc **cấp trang** là chuyện khác và thuộc về T2
 * (`AccountSettings.tsx`, `vm.errorMessage`).
 *
 * ## Hàng thu chiều cao, và cái nút chìm
 *
 * Đăng xuất một phiên là việc A8 hoàn tác được, nên nó **không** có hộp thoại —
 * hộp thoại của A9 dành cho thứ không hoàn tác được, và ở màn này chỉ có vùng
 * nguy hiểm là như vậy. Hàng biến mất ngay, thu chiều cao về 0 rồi biến, và một
 * vé hoàn tác 8 giây (`UNDO_WINDOW_MS`) chạy song song; lượt thu hồi thật chỉ
 * gửi đi khi vé hết hạn. `useAccountAuth` giữ toàn bộ phần đó.
 *
 * Đặc tả viết 240 ms cho lượt thu chiều cao. Thang chuyển động của mục B không
 * có 240 — nó có 120/180/260/340 — nên ở đây là `durationSeconds('standard')`,
 * tức 260 ms, đúng nấc gần nhất và đúng cách `useCommitFlash.ts` đã thay 400 ms
 * bằng `durationMs('slow')`. Bật "giảm chuyển động" thì `reducedMotion` biến con
 * số đó thành 0: hàng **cắt** đi chứ không thu nhanh hơn, vì một hoạt cảnh ngắn
 * vẫn là một hoạt cảnh.
 *
 * ## Luật của mối nối
 *
 * - Hai tên xuất — `SessionsSection` và `SessionsSectionProps` — đã có nơi nhập
 *   theo, nên không đổi tên.
 * - Khung thẻ do `AccountSettings.tsx` vẽ sẵn; file này chỉ vẽ **ruột**.
 * - View thuần: `reducedMotion` vào bằng prop chứ không đọc `matchMedia` tại
 *   chỗ, vì một view đọc môi trường thì không còn test được chỉ từ props.
 * - `lastActiveLabel` là **chuỗi đã xong**. A15 nói định dạng xảy ra ở viewmodel;
 *   `formatTimestamp` được gọi trong `useAccountAuth`, không ở đây.
 * - Chuỗi thiết bị thật do máy chủ trả về sẽ mang tên riêng tiếng Anh (`Chrome`,
 *   `Windows`). Bộ kiểm cấp màn nhận chúng qua `expectVietnamese(container, {
 *   allowWords: [...] })`; bản đứng thay hiện tại chỉ dùng tiếng Việt nên chưa
 *   cần tới.
 */

import { AnimatePresence, motion } from '@/components/motion';
import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { durationSeconds } from '@/lib/motion';

/** Một phiên như khối này vẽ nó: mọi con số đã thành chữ. */
export interface AccountSessionRow {
  readonly id: string;
  readonly device: string;
  readonly location: string;
  /** Hoạt động cuối, đã thành câu tương đối — "12 phút trước", "vừa xong". */
  readonly lastActiveLabel: string;
  /** Phiên của chính trình duyệt đang mở màn này. */
  readonly isCurrent: boolean;
}

export interface SessionsSectionProps {
  readonly rows: readonly AccountSessionRow[];
  /** Trạng thái 3: đọc phiên hỏng. Dải cảnh báo nằm trong khối, `null` khi đọc được. */
  readonly warning: string | null;
  readonly onRetry: () => void;
  readonly onSignOut: (sessionId: string) => void;
  /** Phiên đang chờ máy chủ trả lời, hoặc `null`. */
  readonly signingOutId: string | null;
  /** Người dùng đã xin ít chuyển động: thu hàng thành một nhát cắt. */
  readonly reducedMotion: boolean;
}

export function SessionsSection(props: SessionsSectionProps) {
  const hasRows = props.rows.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {props.warning === null ? null : (
        <InlineAlert
          level="attention"
          title="Không đọc được danh sách phiên"
          message={props.warning}
          action={{ label: 'Thử lại', onClick: props.onRetry, variant: 'secondary' }}
        />
      )}

      {hasRows ? (
        <ul className="flex flex-col">
          <AnimatePresence initial={false}>
            {props.rows.map((row) => (
              <motion.li
                key={row.id}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  duration: durationSeconds('standard', { reducedMotion: props.reducedMotion }),
                }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[14px] font-medium text-text-primary">{row.device}</span>
                    <span className="text-[13px] text-text-secondary">
                      {row.location} · {row.lastActiveLabel}
                    </span>
                  </div>

                  {row.isCurrent ? (
                    <span className="rounded-full bg-bg-sunken px-2 py-1 text-[12px] text-text-secondary">
                      thiết bị này
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Đăng xuất khỏi ${row.device}`}
                      onClick={() => props.onSignOut(row.id)}
                      loading={props.signingOutId === row.id}
                      disabled={props.signingOutId !== null}
                    >
                      Đăng xuất
                    </Button>
                  )}
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        props.warning === null && (
          <p className="text-[13px] text-text-secondary">Chưa có phiên nào đang mở.</p>
        )
      )}
    </div>
  );
}
