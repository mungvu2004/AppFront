/**
 * Bản nháp cài đặt tài khoản — mối nối giữa ba hook con và một lượt tự lưu.
 *
 * File này là **module thấp nhất** của màn `/tai-khoan`: nó không nhập gì trong
 * thư mục màn, nên ba hook con và `useAccountSettings` đều nhập được nó mà
 * không khép một vòng import nào (`pnpm cycles` chạy `import/no-cycle` ở độ sâu
 * không giới hạn).
 *
 * ## Mối nối, nói một lần cho cả ba người dựng tiếp
 *
 * Bất biến A7 nói màn này **không có nút lưu**: 800 ms sau thao tác cuối, trang
 * tự gửi đi. Chỗ đặt bộ đếm đó là `useAccountSettings.ts`, đúng một chỗ — hook
 * con KHÔNG tự dựng `createAutosave` của riêng nó, vì hai bộ đếm chạy song song
 * thì `SaveIndicator` không còn nói được câu nào đúng cho cả trang.
 *
 * Cách một hook con báo lên:
 *
 * ```ts
 * // trong useAccountPreferences.ts
 * const theme = port.saved?.appearance.theme ?? 'light';
 * port.stage('appearance', { theme: 'dark' });   // xong. Trang lo phần còn lại.
 * ```
 *
 * - `port.saved` là bản máy chủ đã trả về. `undefined` nghĩa là trang **còn
 *   đang tải** — đó là trạng thái 2, và nó do T2 vẽ khung xương cho cả trang,
 *   nên hook con không cần vẽ thêm khung xương nào nữa.
 * - `port.stage(section, fields)` gộp `fields` vào bản nháp của `section` rồi
 *   đánh thức bộ tự lưu. Gọi bao nhiêu lần cũng được; chỉ lượt cuối tính giờ.
 *
 * ## Ba khối có mặt ở đây, bốn khối không
 *
 * `AccountDraftSection` chỉ có `profile`, `appearance`, `notifications` — ba
 * khối thật sự có thứ để lưu. Bốn khối còn lại cố ý vắng mặt:
 *
 * - **mật khẩu** — [CẤM TUYỆT ĐỐI] không tự lưu mật khẩu. Không có khoá nào ở
 *   đây cho nó, nên không có đường nào để lỡ tay lưu. `useAccountAuth` không
 *   nhận `AccountDraftPort`, và đó là lý do.
 * - **phiên đăng nhập**, **vùng nguy hiểm** — việc chủ động, không phải cài đặt;
 *   chúng đi qua hộp thoại xác nhận của A9 chứ không qua bộ tự lưu của A7.
 * - **phím tắt** — chỉ đọc, dựng từ `buildGlobalShortcuts`.
 */

/** Khối cài đặt có thứ để lưu. Thêm khoá vào đây là việc của T2, không của hook con. */
export type AccountDraftSection = 'appearance' | 'notifications' | 'profile';

/**
 * Các trường của một khối.
 *
 * Cố ý để `unknown`: hình dạng thật của từng khối thuộc về người dựng khối đó,
 * và cổng lưu chỉ chuyển tiếp chứ không đọc. Hook con giữ kiểu chặt của riêng
 * nó ở phía trên và ép xuống đây đúng một lần, tại chỗ gọi `stage`.
 */
export type AccountDraftFields = Readonly<Record<string, unknown>>;

/** Toàn bộ cài đặt tài khoản, gom theo khối. */
export type AccountDraft = Readonly<Record<AccountDraftSection, AccountDraftFields>>;

/** Ba khối rỗng — hình dạng khởi đầu, và cũng là thứ cổng lưu trả về lần đầu. */
export const EMPTY_ACCOUNT_DRAFT: AccountDraft = Object.freeze({
  appearance: Object.freeze({}),
  notifications: Object.freeze({}),
  profile: Object.freeze({}),
});

/**
 * Cửa duy nhất một hook con dùng để nói "tôi vừa đổi thứ này".
 *
 * Ba hook con nhận cùng một cổng, nên không hook nào giành được quyền lưu của
 * hook khác, và không hook nào phải biết bộ tự lưu nằm ở đâu.
 */
export interface AccountDraftPort {
  /** Bản đã lưu; `undefined` khi trang còn đang tải (trạng thái 2, T2 vẽ). */
  readonly saved: AccountDraft | undefined;
  /** Gộp `fields` vào khối `section` rồi hẹn giờ gửi đi. */
  readonly stage: (section: AccountDraftSection, fields: AccountDraftFields) => void;
}

/** Bản nháp mới với một khối đã gộp thêm `fields`. Không sửa bản cũ tại chỗ. */
export function mergeAccountDraft(
  draft: AccountDraft,
  section: AccountDraftSection,
  fields: AccountDraftFields,
): AccountDraft {
  return { ...draft, [section]: { ...draft[section], ...fields } };
}

/**
 * Hai bản nháp có khác nhau không.
 *
 * So bằng `JSON.stringify` chứ không so từng khoá: giá trị ở đây là dữ liệu
 * thuần đi qua cổng lưu, không có hàm và không có tham chiếu vòng, nên phép so
 * này đủ và nó không phải sửa lại mỗi lần một khối mọc thêm trường.
 */
export function isSameAccountDraft(left: AccountDraft, right: AccountDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
