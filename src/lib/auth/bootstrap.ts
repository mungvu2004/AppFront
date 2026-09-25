/**
 * Phần thuần của tầng phiên: ghép đường, và người dùng vừa rồi là ai.
 *
 * File này **không nhập `./session` hay `./refresh`** — hai module đó nhập nó,
 * nên một đường nhập ngược lại là một vòng mà `pnpm cycles` bắt được. Nó cũng
 * không nhập `src/lib/http`: hàm ghép đường ở đây là hàm của tầng phiên, còn
 * `buildUrl` của `src/lib/http` là hàm của tầng vận chuyển, và hai bên thuộc
 * hai prompt khác nhau.
 */

/** `path` đã là một URL tuyệt đối chứ không phải một đường tương đối. */
const hasScheme = (path: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(path);

/**
 * Đường thật của một lượt gọi tầng phiên.
 *
 * `new URL('/auth/refresh', 'https://may-chu/api')` cho ra
 * `https://may-chu/auth/refresh` — **mất `/api`**, vì một đường bắt đầu bằng
 * `/` thay cả đường dẫn của base chứ không nối vào sau nó. Đó chính là lỗi
 * khiến lượt gia hạn và lượt đăng xuất rơi ra ngoài `/api`. Hàm này nối vào
 * sau đường gốc, và nhận ra khi `path` đã mang sẵn đường gốc ấy.
 *
 * **Có một bản sinh đôi ở `src/api/endpoints.ts` (`toApiUrl`), và đó là cố ý —
 * đừng gộp hai hàm lại.** Tầng phiên không được nhập `src/api` (CLAUDE.md mục
 * 0.4): gộp lại là dựng đúng cái vòng nhập mà ranh giới ấy tồn tại để chặn.
 *
 * Hai bản phải cho **cùng một kết quả trên cùng một đầu vào**, và điều đó được
 * khoá lại bằng một bảng đầu vào dùng chung chạy qua cả hai hàm
 * (`src/api/__tests__/urlJoiners.test.ts`). Sửa một bên thì sửa cả hai, rồi
 * chạy bảng ấy.
 */
export const resolveAuthUrl = (baseUrl: string, path: string): string => {
  if (hasScheme(path)) {
    return path;
  }

  const base = new URL(baseUrl);
  const root = base.pathname.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;

  if (root.length === 0 || suffix === root || suffix.startsWith(`${root}/`)) {
    return new URL(suffix, base.origin).toString();
  }

  return new URL(`${root}${suffix}`, base.origin).toString();
};

/**
 * Người dùng của lượt phiên gần nhất, **sống qua cả lúc ẩn danh**.
 *
 * Đăng xuất rồi đăng nhập bằng tài khoản khác trên cùng một thẻ là chuyện
 * thường ngày, và giữa hai lượt ấy trạng thái phiên đã về `anonymous` — nên
 * nếu con số này nằm trong trạng thái phiên thì nó bị xoá đúng lúc cần nó
 * nhất, và dữ liệu của người trước ở lại trên màn của người sau.
 */
let lastKnownUserId: string | null = null;

export const getLastKnownUserId = (): string | null => lastKnownUserId;

export const setLastKnownUserId = (userId: string | null): void => {
  lastKnownUserId = userId;
};

export const __resetLastKnownUserForTests = (): void => {
  lastKnownUserId = null;
};

/**
 * Lệch đồng hồ giữa máy này và máy chủ, đo ở một phản hồi THÀNH CÔNG.
 *
 * Máy khách chạy nhanh chín phút thì mọi `expiresAt` của máy chủ trông như
 * sắp hết hạn, `remainingMs` luôn nhỏ hơn thời gian đón đầu, và lịch hẹn gia
 * hạn quay vòng liên tục. Trừ con số này ra khỏi `now()` là đưa hai đồng hồ
 * về cùng một gốc. Vắng tiêu đề `Date`, hoặc tiêu đề ấy không đọc được, thì
 * lệch bằng không — không đoán.
 */
export const resolveServerOffsetMs = (dateHeader: string | null, now: number): number => {
  if (!dateHeader) {
    return 0;
  }

  const serverNow = Date.parse(dateHeader);

  return Number.isNaN(serverNow) ? 0 : serverNow - now;
};

/** Khoảng chờ ngắn nhất và dài nhất giữa hai lượt thử lại sau một lỗi TẠM. */
export const RETRY_MIN_DELAY_MS = 1_000;
export const RETRY_MAX_DELAY_MS = 60_000;

const clampRetryDelayMs = (delayMs: number): number =>
  Math.min(Math.max(delayMs, RETRY_MIN_DELAY_MS), RETRY_MAX_DELAY_MS);

/**
 * Bao lâu nữa thì thử gia hạn lại, sau lượt hỏng thứ `attempt` (đếm từ 1).
 *
 * `Retry-After` của máy chủ được ưu tiên — nó biết rõ hơn ta bao giờ nó rảnh.
 * Vắng nó thì lùi gấp đôi: 1, 2, 4, 8… giây. Cả hai đường đều bị kẹp trong
 * `[RETRY_MIN_DELAY_MS, RETRY_MAX_DELAY_MS]`: dưới sàn là đập cửa máy chủ
 * đang ốm, trên trần là bỏ rơi một phiên còn sống.
 */
export const resolveRetryDelayMs = (retryAfterHeader: string | null, attempt: number): number => {
  const seconds = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
  if (Number.isFinite(seconds)) {
    return clampRetryDelayMs(seconds * 1_000);
  }

  return clampRetryDelayMs(RETRY_MIN_DELAY_MS * 2 ** Math.max(attempt - 1, 0));
};
