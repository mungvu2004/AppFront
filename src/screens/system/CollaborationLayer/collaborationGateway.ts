/**
 * Cổng dữ liệu của lớp phủ cộng tác — và, quan trọng hơn, chỗ ghi thành mã
 * việc lớp này CHƯA có dây gì phía sau.
 *
 * ## Ba mươi giây đầu: cổng này không mở kết nối nào
 *
 * Không `new EventSource`, không `fetch`, không chuỗi đường dẫn. Lý do không
 * phải là lười: `src/api/endpoints.ts` không có nhóm nào cho hiện diện, khoá
 * hay bình luận, mà R-65 cấm viết thẳng một chuỗi đường dẫn trong
 * `src/screens/**` và R-69 cấm stub. Nghĩa là hôm nay **không có đường hợp
 * pháp nào** để lớp này lấy dữ liệu thời gian thực — chứ không phải chưa ai
 * chịu viết. Xem {@link COLLABORATION_CAPABILITIES}: mỗi cờ tắt kèm đúng tên
 * thứ còn thiếu, và `LOGIC-REQUESTS.md` cạnh file này là bản kê đầy đủ.
 *
 * ## Phần chạy được thật
 *
 * `src/lib/versioning/conflict.ts` và `mergeStrategies.ts` **có thật, có test**.
 * Nên {@link CollaborationGateway.toConflictVm} là phần duy nhất ở đây đụng vào
 * dữ liệu thật: nó nhận một `FieldConflict` do `resolveConflict` sinh ra và
 * dựng câu người đọc được cho **cả hai phía**.
 *
 * Cái bẫy mà hợp đồng (`types.ts`) đã nêu và file này giải: `FieldConflict`
 * mang tác giả và thời điểm cho phía HỌ (`remoteChange.changedBy` /
 * `.changedAt`) nhưng phía MÌNH chỉ có `localValue` — không tên, không mốc thời
 * gian. Đặc tả lại bắt hiện đủ cả hai tác giả kèm thời điểm. Nên phía mình lấy
 * tên từ `getSession().user` (`@/lib/auth`) và mốc thời gian từ tham số
 * `localChangedAtIso` do hook ghi lại lúc người dùng sửa cục bộ. Cả hai mốc đi
 * qua `formatTimestamp` (P-02, A15 — định dạng ở viewmodel chứ không ở view).
 *
 * ## Vì sao {@link readActorName} được VIẾT LẠI ở đây
 *
 * `VersionHistory/versionHistoryGateway.ts:255` đã có một hàm cùng tên và cùng
 * bảy dòng. Nhập nó về sẽ kéo cả bộ lịch sử phiên bản vào phần gói của tuyến
 * nào dựng lớp này — cổng kích thước gói đo theo TỪNG tuyến. Bảy dòng thuần rẻ
 * hơn một phụ thuộc chéo màn. (Chữ tắt thì khác: `initialsOf` sống ở
 * `@/lib/format/initials`, tầng thuần, nên mọi màn nhập chung một bản — QA-01c nợ #1.)
 */

import { getSession } from '@/lib/auth';
import type { SessionSnapshot } from '@/lib/auth';
import { formatTimestamp } from '@/lib/format/datetime';
import { MISSING_VALUE, formatNumber } from '@/lib/format/number';
import type { FieldConflict } from '@/lib/versioning/mergeStrategies';

import type { CollaborationCapabilities, CollaborationGateway, ConflictVm } from './types';

/* -------------------------------------------------------------------------- */
/* 1 — Năng lực: bốn cờ tắt, mỗi cờ kèm tên thứ còn thiếu                      */
/* -------------------------------------------------------------------------- */

/**
 * Bốn năng lực của lớp phủ, và tình trạng dây thật của từng cái.
 *
 * Đây **không phải** bốn cờ trang trí chờ ai đó bật. Mỗi cờ là một cổng thật mà
 * view đọc để quyết định *có dựng* nhánh đó không (xem chú thích của
 * `CollaborationCapabilities` trong `types.ts`), và mỗi cờ tắt vì một thứ cụ
 * thể, gọi được tên, đang thiếu.
 *
 * - `presence` cần một nhóm endpoint hiện diện trong `src/api/endpoints.ts`
 *   (dòng "ai đang xem, đang ở tầng nào, con trỏ ở đâu") **và** một schema
 *   `PresenceSchema` trong `src/api/schemas/` để `createEventChannel`
 *   (`@/lib/realtime/eventChannel`) phân tích được gói tin. Cả hai đều không
 *   tồn tại: nhóm `notifications` có `stream`, nhưng dòng ấy mang
 *   `NotificationSchema`, không mang hiện diện.
 * - `comments` cần một nhóm endpoint bình luận (liệt kê ghim theo tầng, tạo
 *   ghim, trả lời, đánh dấu đã giải quyết), một `CommentSchema` cùng
 *   `CommentThreadSchema`, và một nhánh `comment` trong
 *   `src/lib/query/queryKeys.ts`. Không thứ nào tồn tại; loại thông báo
 *   `commentMention` của T-09 là một thông báo VỀ bình luận, không phải bình
 *   luận.
 * - `locks` cần cùng nhóm endpoint hiện diện ở trên (ai đang giữ đối tượng
 *   nào, từ lúc nào) cộng một `LockSchema`. Không state, không schema, không
 *   endpoint nào trong `src/store`, `src/api` hay `src/domain` mang khái niệm
 *   khoá.
 * - `requestAccess` cần `locks` bật trước — xin quyền là xin một khoá đang có
 *   chủ — cộng một phép ghi chuyển giao khoá và một mục tương ứng trong
 *   `WRITE_OPERATIONS` của `src/lib/query/invalidation.ts`, để lượt ghi ấy làm
 *   mới đúng bộ khoá thay vì để màn tự vá tại chỗ.
 *
 * Chuyển một cờ sang `true` mà chưa có đủ những thứ trên là dựng một nhánh giao
 * diện gọi vào chỗ trống — đúng thứ hợp đồng dựng ra bốn cờ này để chặn.
 */
export const COLLABORATION_CAPABILITIES: CollaborationCapabilities = Object.freeze({
  presence: false,
  comments: false,
  locks: false,
  requestAccess: false,
});

/* -------------------------------------------------------------------------- */
/* 2 — Tra tên người                                                           */
/* -------------------------------------------------------------------------- */

/** Một người có thể xuất hiện trong `changedBy` của một thay đổi từ xa. */
export interface CollaborationActor {
  readonly id: string;
  readonly name: string;
}

/**
 * `changedBy` sang tên hiển thị; lùi về chính chuỗi thô khi không tra được.
 *
 * Lùi về `changedBy` chứ không về một chữ chung như "người khác": một mã người
 * dùng hiện trên panel thì xấu, nhưng nó vẫn là **đúng người**, còn "người
 * khác" gộp hai người lạ thành một và người đọc không phân biệt nổi hai xung
 * đột liên tiếp là của ai.
 */
export function readActorName(
  changedBy: string,
  members: readonly CollaborationActor[] | undefined,
): string {
  return members?.find((member) => member.id === changedBy)?.name ?? changedBy;
}

/** Tên hiện cho phía mình khi phiên đăng nhập chưa nói được bạn là ai. */
export const SELF_FALLBACK_NAME = 'bạn';

/**
 * Tên hiển thị của chính người đang ngồi trước máy.
 *
 * Ba nguồn theo thứ tự giảm dần độ dễ đọc: tên, thư điện tử, mã người dùng.
 * Chưa đăng nhập thì {@link SELF_FALLBACK_NAME} — hợp đồng nói "không bên nào
 * được để trống", và một chuỗi rỗng ở cột "của bạn" biến panel xung đột thành
 * một câu hỏi không nói rõ đang hỏi ai.
 */
export function readSelfName(session: SessionSnapshot): string {
  const user = session.user;
  if (user === null) {
    return SELF_FALLBACK_NAME;
  }

  // `||`, không `??`: `name: ''` của máy chủ phải rơi về email (cùng mẫu BUG-031).
  return user.name?.trim() || user.email?.trim() || user.id || SELF_FALLBACK_NAME;
}

/* -------------------------------------------------------------------------- */
/* 3 — Tên thuộc tính và giá trị sang chữ người đọc được                       */
/* -------------------------------------------------------------------------- */

/**
 * Tên thuộc tính trên dây sang nhãn tiếng Việt.
 *
 * Tám khoá dưới đây là đúng những thuộc tính mà `src/lib/versioning` sinh ra và
 * kiểm. Đây không phải bảng dịch đoán trước: một khoá lạ rơi xuống nhánh lùi và
 * hiện nguyên tên thô, vì một tên thuộc tính khó đọc vẫn nói đúng thứ đang
 * tranh chấp, còn một nhãn bịa thì nói sai.
 */
const FIELD_LABELS: Readonly<Record<string, string>> = Object.freeze({
  area_m2: 'Diện tích',
  confidence: 'Độ tin cậy',
  elevation_m: 'cao độ',
  review_state: 'Trạng thái duyệt',
  rotation_deg: 'góc xoay',
  thickness_mm: 'bề dày',
  vertices: 'các đỉnh',
  width_mm: 'bề rộng',
});

/** Nhãn tiếng Việt của một thuộc tính; lùi về chính tên thô khi chưa có nhãn. */
export function toFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Hai nhãn của một giá trị luận lý, viết thường kiểu câu (A6). */
const BOOLEAN_LABELS: Readonly<Record<'true' | 'false', string>> = Object.freeze({
  true: 'Có',
  false: 'Không',
});

/**
 * Một giá trị bất kỳ sang chuỗi hiện được trên panel xung đột.
 *
 * `localValue` và `remoteChange.value` đều là `unknown` — đúng như chúng phải
 * thế, vì cùng một phép so sánh chạy cho bề dày (số), trạng thái duyệt (chuỗi)
 * và danh sách đỉnh (mảng). Chuyển đổi xảy ra ở ĐÂY, tại viewmodel, không ở
 * view (A15), và số đi qua `formatNumber` nên dấu thập phân là dấu phẩy.
 *
 * Giá trị phức hợp giữ nguyên hình dạng JSON thay vì rút thành một câu như "một
 * danh sách": đặc tả bắt panel hiện **cả hai giá trị**, và hai câu tóm tắt
 * giống hệt nhau thì không giúp ai chọn được bên nào.
 */
export function toValueLabel(value: unknown): string {
  if (value === null || value === undefined) {
    return MISSING_VALUE;
  }

  if (typeof value === 'number') {
    return formatNumber(value);
  }

  if (typeof value === 'string') {
    return value === '' ? MISSING_VALUE : value;
  }

  if (typeof value === 'boolean') {
    return BOOLEAN_LABELS[value ? 'true' : 'false'];
  }

  return JSON.stringify(value) ?? MISSING_VALUE;
}

/* -------------------------------------------------------------------------- */
/* 4 — Cổng                                                                    */
/* -------------------------------------------------------------------------- */

/** Thứ {@link createCollaborationGateway} nhận được để tiêm vào lúc dựng. */
export interface CreateCollaborationGatewayOptions {
  /**
   * Danh sách thành viên để tra `changedBy` sang tên hiển thị.
   *
   * Bỏ trống ⇒ panel hiện mã người dùng thô. Nguồn thật của danh sách này là
   * khoá `queryKeys.project.members(projectId)` — cùng khoá `ShareDialog` đọc —
   * nên nơi ráp lớp phủ vào một dự án cụ thể truyền nó xuống; cổng không tự
   * đọc, vì một cổng thuần không được giữ một `QueryClient`.
   */
  readonly members?: readonly CollaborationActor[];
  /** Đồng hồ. Tiêm được vì `formatTimestamp` là hàm thuần của hai tham số. */
  readonly now?: () => number;
  /** Phiên đăng nhập. Tiêm được để bộ kiểm dựng panel mà không phải đăng nhập thật. */
  readonly readSession?: () => SessionSnapshot;
}

/**
 * Cổng của lớp phủ cộng tác.
 *
 * Hai thành viên, đúng như hợp đồng: bốn cờ năng lực và một phép chuyển thuần.
 * Không có `list`, không có `subscribe`, không có phép ghi — và sự VẮNG MẶT ấy
 * chính là nội dung của {@link COLLABORATION_CAPABILITIES}, không phải một
 * thiếu sót chờ lấp bằng dữ liệu bịa.
 *
 * Cổng **không tự giải quyết xung đột**: nó dựng câu cho cả hai phía rồi dừng.
 * Ai thắng là quyết định của con người, đi qua `onResolveConflict` của hook.
 */
export function createCollaborationGateway(
  options: CreateCollaborationGatewayOptions = {},
): CollaborationGateway {
  const members = options.members;
  const now = options.now ?? Date.now;
  const readSession = options.readSession ?? getSession;

  return {
    capabilities: COLLABORATION_CAPABILITIES,

    toConflictVm: (conflict: FieldConflict, localChangedAtIso: string): ConflictVm => {
      const nowMs = now();

      return {
        entityId: conflict.entityId,
        entityType: conflict.entityType,
        fieldLabel: toFieldLabel(conflict.field),
        mine: {
          valueLabel: toValueLabel(conflict.localValue),
          authorName: readSelfName(readSession()),
          atLabel: formatTimestamp(Date.parse(localChangedAtIso), nowMs),
        },
        theirs: {
          valueLabel: toValueLabel(conflict.remoteChange.value),
          authorName: readActorName(conflict.remoteChange.changedBy, members),
          atLabel: formatTimestamp(Date.parse(conflict.remoteChange.changedAt), nowMs),
        },
      };
    },
  };
}
