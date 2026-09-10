/**
 * Hình dạng dữ liệu của màn "bạn chưa có quyền truy cập" — nguồn sự thật của cả màn.
 *
 * ## Vì sao có file này
 *
 * Màn này dựng bởi bốn lượt song song (hook+cổng, view+hình vẽ, test+story,
 * i18n+route). Mỗi lượt tự khai hình dạng của mình thì bốn bản lệch nhau đúng vào
 * lúc ghép. File này đông lạnh hình dạng trước khi lượt nào bắt đầu — cùng vai trò
 * `notFoundModel.ts` giữ cho màn S-43.
 *
 * ## BẢY KHOẢN ĐẶC TẢ NÓI MỘT ĐẰNG, REPO CÓ MỘT NẺO
 *
 * Đã khảo sát bằng bốn lượt đọc song song TRƯỚC khi viết dòng này, và điều phối
 * viên đã tự kiểm lại từng khoản. Đây là kết luận đã chốt, **không phải phỏng
 * đoán** — worker KHÔNG được tự sửa lại, và cũng KHÔNG cần mở lại các file ấy.
 *
 * 1. **"T-05 gọi API xin quyền" — KHÔNG TỒN TẠI.** `ENDPOINTS` có 13 nhóm; toàn bộ
 *    khoá phẳng của nó là: acceptInvite · activity · assess · changeRole · chunk ·
 *    complete · corners · create · delete · detail · disable · enable · floor ·
 *    initUpload · invite · layer · list · login · markAllRead · markRead ·
 *    memberships · progress · read · register · remove · reorder · resendInvite ·
 *    straighten · stream · update · version. Không khoá nào cho **người bị chặn**
 *    xin vào một dự án. `invite`/`changeRole`/`remove` là hành động của CHỦ dự án
 *    theo chiều ngược lại. `requestAccess` của `CollaborationLayer` là tính năng
 *    KHÁC (xin lại khoá sửa bên trong một dự án đã vào được), và nó cũng đang tắt.
 *
 * 2. **Chủ dự án — KHÔNG CÓ TRƯỜNG NÀO.** `Project` (`src/types/project.ts:10-17`)
 *    là `{id, name, created_at, updated_at, thumbnail_url?, members}`. Không
 *    `owner`, không `ownerId`, không `createdBy`. Và kể cả `members` cũng KHÔNG với
 *    tới được: đọc nó phải gọi `projects.read`, tức là đúng cái endpoint vừa trả 403.
 *
 * 3. **X-04 "đọc thông tin liên kết chia sẻ" — KHÔNG VỚI TỚI ĐƯỢC từ màn này.**
 *    `listShareLinks(projectId)` gọi `/projects/{id}/share-links` bằng chính bearer
 *    token vừa bị từ chối. Nó là kho liên kết của NGƯỜI CHIA SẺ, không phải cửa sổ
 *    cho người bị chặn nhìn vào.
 *
 * 4. **Xác thực mật khẩu liên kết — KHÔNG TỒN TẠI.** `shareLink.ts` chỉ nhận mật
 *    khẩu lúc TẠO liên kết; không hàm nào nhận mật khẩu để mở khoá.
 *
 * 5. **L-03 gộp mọi 403 thành một `kind`, NHƯNG GIỮ NGUYÊN `code`.**
 *    `toAppError` đặt `kind: 'forbidden'` cho mọi 403, và `describeError` chỉ tra
 *    theo `kind` — nên hai hàm đó một mình không phân biệt được ba lý do. Nhưng
 *    `fromHttpError` truyền `error.code` xuống `resolveCode`, và `resolveCode` chỉ
 *    rơi về `'FORBIDDEN'` KHI máy chủ không gửi mã nào. Vậy `AppError.code` là kênh
 *    phân biệt còn mở, và {@link resolveAccessDeniedReason} là chỗ duy nhất đọc nó.
 *
 * 6. **O-01 — không có sự kiện riêng, nhưng có đường hợp lệ.** Không event nào tên
 *    "blocked"/"denied". `screen.error` (`telemetry/events.ts:290`) nhận `errorKind`
 *    BẮT BUỘC, và `'forbidden'` nằm trong `APP_ERROR_KINDS`. Ghi sự kiện bị chặn đi
 *    đường đó, không dựng event mới.
 *
 * 7. **"Hình minh hoạ nét 120" là ĐỌC NHẦM.** S-43 có `ILLUSTRATION_SIZE_PX = 120`
 *    và `ILLUSTRATION_STROKE_WIDTH = 1.5` là hai hằng khác nhau. 120 là KÍCH THƯỚC
 *    hình, không phải độ dày nét — nét 120 sẽ là một khối đặc, không phải bản vẽ.
 *
 * ## Hệ quả: cờ năng lực, không phải mã giả
 *
 * Bốn khoản đầu nghĩa là bảy phần của bố cục đặc tả không có nguồn dữ liệu. Cách xử
 * lý là cách `CollaborationLayer` đã dùng và đã có tiền lệ trong repo: **cổng năng
 * lực**. View dựng ĐỦ mọi khối và chạy hoàn toàn bằng props;
 * {@link AccessDeniedCapabilities} quyết định khối nào có mặt. Hôm nay cổng thật trả
 * `false` ⇒ khối RỜI KHỎI DOM — không `disabled`, không ẩn bằng CSS, không mã giả,
 * không `TODO` (R-69).
 *
 * Story và test chạy nhánh `true` bằng props dựng sẵn, nên bố cục đầy đủ là thứ xem
 * được và có test phủ — nó chỉ chưa có dữ liệu thật để chạy, chứ không phải chưa tồn
 * tại. Ngày T-05 có thật, lật cờ trong cổng là xong; không dòng nào của view phải sửa.
 *
 * ## Chuyển động
 *
 * Đặc tả nói 240ms. `MOTION_DURATIONS_MS` có đúng năm giá trị 120/180/260/340/700 và
 * 240 KHÔNG nằm trong đó. Luật thắng prompt (LUAT_MAN_HINH thứ tự ưu tiên), nên xác
 * nhận dùng **260ms** — giá trị gần nhất trong thang.
 */

import type { AppError } from '@/lib/errors/kinds';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* -------------------------------------------------------------------------- */
/* 1 — Bảy trạng thái                                                          */
/* -------------------------------------------------------------------------- */

/** Trạng thái màn — dùng lại đúng bảy tên của A11, không đặt tên riêng. */
export type AccessDeniedScreenState = SevenState;

/**
 * `forbidden` là trạng thái MẶC ĐỊNH của màn này, không phải trạng thái ngoại lệ.
 *
 * Khác biệt với `empty`: `empty` là "đã vào được màn, chưa gửi yêu cầu nào" — nó chỉ
 * xảy ra khi {@link AccessDeniedCapabilities.canRequestAccess} bật. Khi cờ ấy tắt,
 * `empty` và `forbidden` hiện cùng một thứ, và đó là đúng: không có yêu cầu nào để
 * mà rỗng.
 */
export const DEFAULT_SCREEN_STATE: AccessDeniedScreenState = 'forbidden';

/* -------------------------------------------------------------------------- */
/* 2 — Lý do bị chặn                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Bốn lý do, không phải ba.
 *
 * Đặc tả nêu ba (thu hồi · hết hạn · sai mật khẩu). Lý do thứ tư `unknown` là MẶC
 * ĐỊNH và là thứ khiến ba cái kia trung thực: màn chỉ gọi tên một lý do khi mã lỗi
 * nói ra, còn lại nói một câu trung tính. Không có nó, màn sẽ phải đoán — và đoán
 * sai với người dùng là thứ họ không có cách nào biết.
 *
 * Từ vựng mượn của `ShareLinkStatus` (`lib/export/shareLink.ts:108`) đã có sẵn trong
 * repo, không phải bộ chữ mới bịa ra.
 */
export const ACCESS_DENIED_REASONS = ['revoked', 'expired', 'password', 'unknown'] as const;

export type AccessDeniedReason = (typeof ACCESS_DENIED_REASONS)[number];

/**
 * Nhận ra lý do bằng TỪ trong mã lỗi, không bằng bảng mã cứng.
 *
 * Repo không định nghĩa bộ mã 403 của máy chủ ở đâu cả, nên khai một bảng
 * `'SHARE_LINK_REVOKED' -> 'revoked'` là bịa ra một hợp đồng không bên nào ký. Cách
 * này chỉ nhận ra một TỪ — cùng ba từ mà `ShareLinkStatus` đã dùng — nên nó đúng với
 * bất cứ máy chủ nào gửi mã có chứa từ đó, và im lặng rơi về `unknown` với mọi mã
 * khác. Không đoán, không vỡ.
 */
export function resolveAccessDeniedReason(error: AppError | null): AccessDeniedReason {
  if (!error) {
    return 'unknown';
  }

  const code = error.code.toUpperCase();

  if (code.includes('REVOK')) {
    return 'revoked';
  }

  if (code.includes('EXPIR')) {
    return 'expired';
  }

  if (code.includes('PASSWORD')) {
    return 'password';
  }

  return 'unknown';
}

/* -------------------------------------------------------------------------- */
/* 3 — Cờ năng lực                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Bốn cổng thật, không phải bốn công tắc trang trí.
 *
 * Mỗi cờ `false` nghĩa là tầng logic tương ứng CHƯA TỒN TẠI (xem khoản 1-4 của
 * docblock đầu file), và khối giao diện của nó phải RỜI KHỎI DOM.
 */
export interface AccessDeniedCapabilities {
  /** Gửi yêu cầu xin quyền. Cần T-05 — hiện chưa có. */
  readonly canRequestAccess: boolean;
  /** Hiện tên + email + ảnh của chủ dự án. Cần trường chủ trên `Project` — chưa có. */
  readonly canShowOwner: boolean;
  /** Ô nhập mật khẩu liên kết. Cần hàm xác thực mật khẩu — chưa có. */
  readonly canSubmitLinkPassword: boolean;
  /** Nói tên dự án. Chỉ bật khi hệ thống XÁC NHẬN là an toàn; mặc định tắt. */
  readonly canNameProject: boolean;
}

/** Cổng thật hôm nay. Bốn `false` — bốn tầng logic chưa tồn tại. */
export const ACCESS_DENIED_CAPABILITIES_TODAY: AccessDeniedCapabilities = {
  canNameProject: false,
  canRequestAccess: false,
  canShowOwner: false,
  canSubmitLinkPassword: false,
};

/* -------------------------------------------------------------------------- */
/* 4 — Viewmodel                                                               */
/* -------------------------------------------------------------------------- */

/** Một hành động ra ngoài — nhãn đã dựng sẵn, view không tự ghép chữ. */
export interface AccessDeniedAction {
  readonly label: string;
  readonly onActivate: () => void;
}

/** Chủ dự án. `null` khi {@link AccessDeniedCapabilities.canShowOwner} tắt. */
export interface ProjectOwnerVm {
  readonly name: string;
  readonly email: string;
  readonly avatarUrl?: string;
}

/** Tình trạng một yêu cầu đã gửi. `null` khi chưa gửi hoặc khi cổng tắt. */
export interface AccessRequestVm {
  /** Đã gửi lúc nào — chuỗi ĐÃ ĐỊNH DẠNG ở viewmodel, không phải Date (A15). */
  readonly sentAtLabel: string;
  /** Lời nhắn tuỳ chọn của chủ dự án khi từ chối. */
  readonly declineMessage?: string;
}

/**
 * Mọi thứ view cần, đã dựng sẵn. View KHÔNG tính toán, KHÔNG định dạng số, KHÔNG
 * ghép chuỗi có điều kiện — A15 nói định dạng xảy ra ở viewmodel.
 */
export interface AccessDeniedVm {
  readonly state: AccessDeniedScreenState;
  readonly capabilities: AccessDeniedCapabilities;

  /** Tiêu đề h2. */
  readonly title: string;
  /** Câu nêu đúng cái gì bị hạn chế. Đã tính tới `canNameProject`. */
  readonly restrictionSentence: string;
  /** Đoạn giải thích lý do — một trong bốn, do {@link resolveAccessDeniedReason} chọn. */
  readonly reason: AccessDeniedReason;
  readonly reasonSentence: string;
  /** Câu nói rõ AI cấp được quyền. Luôn có, kể cả khi không biết tên chủ. */
  readonly whoCanGrantSentence: string;

  /** Email đang đăng nhập. `null` khi phiên không mang email (`AuthUser.email` tuỳ chọn). */
  readonly currentEmail: string | null;
  readonly identityLabel: string;
  readonly switchAccount: AccessDeniedAction;

  readonly owner: ProjectOwnerVm | null;
  readonly request: AccessRequestVm | null;
  /** Câu nêu lý do bị chặn gửi lại. `null` khi không bị chặn. Không im lặng bỏ qua. */
  readonly throttleSentence: string | null;

  readonly backToProjects: AccessDeniedAction;
  /** Nút vào dự án — chỉ có ở trạng thái `success`. */
  readonly enterProject: AccessDeniedAction | null;

  /** Caption chân trang: mã lỗi nhỏ, chữ đều. */
  readonly errorCodeCaption: string;
  /** Bố cục thu gọn (trạng thái 7). */
  readonly isCompact: boolean;
}

/* -------------------------------------------------------------------------- */
/* 5 — Cổng dữ liệu                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Đúng một phép đọc và hai phép ghi tuỳ chọn.
 *
 * `submitAccessRequest` là `undefined` khi T-05 chưa tồn tại — kiểu tuỳ chọn chứ
 * không phải hàm ném lỗi, để `canRequestAccess` và sự vắng mặt của hàm này luôn nói
 * cùng một điều.
 */
export interface AccessDeniedGateway {
  readonly readCapabilities: () => AccessDeniedCapabilities;
  readonly submitAccessRequest?: (note: string) => Promise<AccessRequestVm>;
  readonly submitLinkPassword?: (password: string) => Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* 6 — Hằng số                                                                 */
/* -------------------------------------------------------------------------- */

/** Kích thước hình minh hoạ, đúng khuôn S-43 (`notFoundModel.ts:159`). */
export const ILLUSTRATION_SIZE_PX = 120;

/** Độ dày nét, đúng khuôn S-43 (`notFoundModel.ts:162`). Không phải 120. */
export const ILLUSTRATION_STROKE_WIDTH = 1.5;

/**
 * Chặn gửi lại: một lần mỗi 10 phút.
 *
 * Không có nguồn nào trong repo cho con số này — đã tìm: không helper throttle /
 * cooldown / rateLimit nào trong `src/lib`, và `600_000` duy nhất tồn tại là `gcTime`
 * của `cachePolicy`, tức thời gian dọn bộ đệm. Mượn nó làm thời gian chờ gửi lại là
 * buộc hai quyết định không liên quan vào một con số (R-71 tồn tại để chặn đúng thứ
 * đó). Nên đây là hằng CÓ TÊN sống trong thư mục màn, không rò ra ngoài — cùng khuôn
 * `RECENT_PROJECT_LIMIT` của S-43.
 */
export const REQUEST_COOLDOWN_MS = 10 * 60 * 1000;

/** Ngưỡng thu gọn (trạng thái 7), đo ở container đúng khuôn S-43. */
export const NARROW_QUERY = '(max-width: 1023px)';

/** Tên màn cho ranh giới lỗi và cho báo cáo của nó. */
export const SCREEN_ID = 'system-access-denied';
