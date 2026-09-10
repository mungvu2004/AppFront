/**
 * Nguồn dữ liệu của màn "bạn chưa có quyền truy cập" — và, quan trọng hơn, chỗ
 * ghi thành mã việc bốn khối của màn này CHƯA có dây gì phía sau.
 *
 * ## Ba mươi giây đầu: cổng này không gọi mạng
 *
 * Không `fetch`, không `ApiClient`, không chuỗi đường dẫn. Lý do đã được khảo
 * sát và chốt ở docblock đầu `accessDeniedModel.ts` (bốn khoản đầu): không
 * endpoint nào cho **người bị chặn** xin vào một dự án, `Project` không có
 * trường chủ, kho liên kết chia sẻ đọc bằng chính bearer token vừa bị từ chối,
 * và không hàm nào nhận mật khẩu để mở khoá một liên kết. Nghĩa là hôm nay
 * **không có đường hợp pháp nào** để màn này lấy dữ liệu — chứ không phải chưa
 * ai chịu viết. Đây đúng khuôn `CollaborationLayer/collaborationGateway.ts` đã
 * ghi lại cho lớp phủ cộng tác.
 *
 * ## Vì sao factory này không nhận `client` hay `now`
 *
 * `notFoundGateway.ts` và `notificationCenterGateway.ts` nhận
 * `(client = createAppApiClient(), now = Date.now)` vì cả hai thật sự đọc máy
 * chủ và thật sự cần một đồng hồ cắm được. {@link AccessDeniedGateway} chỉ có
 * MỘT phép đọc thuần — {@link AccessDeniedGateway.readCapabilities} trả một
 * hằng — nên hai tham số ấy sẽ không bao giờ được đọc. Khai chúng ra chỉ để
 * "giống khuôn" là dựng hai tham số giả, đúng thứ R-69 cấm, và
 * `@typescript-eslint/no-unused-vars` bắt ngay tại chỗ. Ngày một trong hai phép
 * ghi có thật, thêm tham số vào lúc ấy là một dòng.
 */

import {
  ACCESS_DENIED_CAPABILITIES_TODAY,
  type AccessDeniedCapabilities,
  type AccessDeniedGateway,
} from './accessDeniedModel';

/* -------------------------------------------------------------------------- */
/* 1 — Năng lực: bốn cờ tắt, mỗi cờ kèm tên thứ còn thiếu                      */
/* -------------------------------------------------------------------------- */

/**
 * Bốn năng lực của màn, và tình trạng dây thật của từng cái.
 *
 * Đây **không phải** bốn cờ trang trí chờ ai đó bật. Mỗi cờ là một cổng thật mà
 * view đọc để quyết định *có dựng* khối đó không, và mỗi cờ tắt vì một thứ cụ
 * thể, gọi được tên, đang thiếu:
 *
 * - `canRequestAccess` cần T-05 — một nhóm endpoint cho người BỊ CHẶN xin vào
 *   một dự án. `ENDPOINTS` có 13 nhóm và không khoá nào làm việc ấy;
 *   `invite`/`changeRole`/`remove` là hành động của chủ dự án theo chiều ngược
 *   lại, còn `requestAccess` của `CollaborationLayer` là xin lại khoá sửa bên
 *   TRONG một dự án đã vào được (và nó cũng đang tắt).
 * - `canShowOwner` cần một trường chủ trên `Project` (`src/types/project.ts`
 *   có đúng `{id, name, created_at, updated_at, thumbnail_url?, members}`).
 *   Kể cả `members` cũng không với tới được: đọc nó phải gọi `projects.read`,
 *   tức đúng endpoint vừa trả 403.
 * - `canSubmitLinkPassword` cần một hàm xác thực mật khẩu liên kết.
 *   `lib/export/shareLink.ts` chỉ nhận mật khẩu lúc TẠO liên kết; không hàm
 *   nào nhận mật khẩu để mở khoá.
 * - `canNameProject` cần hệ thống XÁC NHẬN là an toàn khi nói tên. Không có
 *   nguồn nào nói được điều đó cho một người chưa có quyền, và đặc tả cấm
 *   tuyệt đối việc tiết lộ tên dự án hay số liệu khi chưa có quyền — nên mặc
 *   định tắt là mặc định duy nhất đúng.
 *
 * Chuyển một cờ sang `true` mà chưa có đủ những thứ trên là dựng một khối giao
 * diện gọi vào chỗ trống — đúng thứ hợp đồng dựng ra bốn cờ này để chặn.
 *
 * Giá trị lấy nguyên từ {@link ACCESS_DENIED_CAPABILITIES_TODAY} của hợp đồng
 * chứ không gõ lại bốn chữ `false`: hợp đồng là nơi bốn lượt song song cùng
 * đọc, nên nó phải là nơi duy nhất bốn cờ ấy sống.
 */
export const ACCESS_DENIED_CAPABILITIES: AccessDeniedCapabilities = ACCESS_DENIED_CAPABILITIES_TODAY;

/* -------------------------------------------------------------------------- */
/* 2 — Cổng                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Cổng thật của màn: một phép đọc, không phép ghi nào.
 *
 * `submitAccessRequest` và `submitLinkPassword` **vắng mặt** (`undefined`) chứ
 * không phải là hàm ném lỗi hay hàm rỗng. Hợp đồng khai hai trường ấy tuỳ chọn
 * đúng vì lý do này: sự vắng mặt của hàm và cờ năng lực tắt phải luôn nói cùng
 * một điều, nên chỉ cần đọc một trong hai là biết cả hai. Một hàm ném lỗi sẽ
 * nói rằng đường đi CÓ nhưng đang hỏng, và đó là câu sai.
 */
export function createAccessDeniedGateway(): AccessDeniedGateway {
  return {
    readCapabilities: () => ACCESS_DENIED_CAPABILITIES,
  };
}
