/**
 * Cổng năng lực của màn báo cáo luật.
 *
 * ## Vì sao cổng này chỉ trả về ba chữ `false`
 *
 * Đây KHÔNG phải chỗ tạm, không phải mã chờ nối dây. Ba năng lực dưới đây thiếu
 * ở TẦNG LOGIC CỦA REPO HÔM NAY, và người duyệt đã chốt trình bày sự thật đó
 * thay vì bịa ra một lớp giả ở tầng màn hình:
 *
 * 1. **`canAutoFix: false` — không có cơ chế sửa tự động nào.** Đã soát toàn bộ
 *    `src/`: không tồn tại bất kỳ ánh xạ `ruleCode -> Command` nào. `Violation`
 *    chỉ mang một chuỗi `suggestion`, và docstring của chính nó
 *    (`domain/rules/registry.ts`) nói rõ đó là "câu tiếng Việt nói cần đổi gì" —
 *    một câu cho NGƯỜI đọc, không phải một lệnh máy chạy được. Không kiểu dữ
 *    liệu nào trong `RuleFinding` / `Violation` / `Rule` mang trường `Command`,
 *    `patch` hay `fix`. Viết logic sửa trong thư mục màn là đúng thứ R-61 sinh
 *    ra để chặn.
 * 2. **`canDismiss: false` — không có trạng thái bỏ qua vi phạm.** Không có
 *    trường `dismissed`, `waived`, `dismissedBy` hay `dismissReason` ở bất kỳ
 *    slice nào của `src/store`, cũng không có ở `src/domain`. Không có nơi nào
 *    ghi lý do bỏ qua và người bỏ qua.
 * 3. **`canPreview3d: false` — không dựng được panel xem trước 3D.**
 *    `mountPresentation(canvas, plan)` của `@/lib/three/present` đòi tham số
 *    thứ hai là một `PresentationPlan` — một lược đồ JSON riêng (tầng, tường,
 *    ô mở, phòng kèm vật liệu sàn, danh sách nội thất) — và repo KHÔNG có bộ đổi
 *    `NormalizedSpatial -> PresentationPlan`; màn đăng nhập đọc một tệp cố định.
 *    Ngoài ra `PresentationHandle` chỉ có `{ dispose, settled, report }`: không
 *    một API camera nào, không nhận `entityId`, nên không khuôn được khung hình
 *    tới đúng đối tượng đang vi phạm.
 *
 * Hệ quả cho tầng view: năng lực nào `false` thì phần giao diện của nó **bị gỡ
 * khỏi DOM**, đúng y cách trạng thái 6 (không có quyền) gỡ mọi hành động sửa —
 * không render nút bị vô hiệu hoá, không render ô trống, không render ghi chú
 * "sắp có".
 *
 * **Khi tầng logic có những năng lực này thì chỉ đổi giá trị ở đây, không phải
 * sửa view.** Cả `useRuleReport.ts` lẫn `RuleReport.tsx` đọc năng lực qua đúng
 * một đường là bộ giá trị cổng này trả về; bật một chữ `false` thành `true` là
 * toàn bộ việc phải làm ở tầng màn hình.
 */

import type { RuleReportCapabilities } from './types';

/**
 * Ba năng lực còn thiếu ở tầng logic, đóng băng lại để không ai lỡ tay ghi đè
 * một chữ `true` ở giữa đường mà không đi qua cổng này.
 */
export const RULE_REPORT_MISSING_CAPABILITIES: Readonly<
  Omit<RuleReportCapabilities, 'canEdit'>
> = Object.freeze({
  canAutoFix: false,
  canDismiss: false,
  canPreview3d: false,
});

/** Ép cảnh cho bài kiểm, đúng khuôn `billingGateway.ts`: tường minh, không biến ẩn. */
export interface RuleReportGatewaySeed {
  /**
   * Ghi đè quyền sửa của người dùng. Không truyền thì cổng dùng đúng giá trị
   * container đưa xuống — đây chỉ để bài kiểm dựng trạng thái 6 mà không phải
   * dựng cả một phiên đăng nhập.
   */
  readonly canEdit?: boolean;
}

export interface RuleReportGateway {
  /**
   * Bộ năng lực của một lượt xem báo cáo.
   *
   * `canEdit` là năng lực THẬT duy nhất còn thay đổi được: nó đến từ quyền của
   * người dùng, do container đưa xuống. Ba chữ còn lại là hằng của repo hôm nay.
   */
  readonly readCapabilities: (canEdit: boolean) => RuleReportCapabilities;
}

/** Cổng thật của màn. Chữ ký này không đổi khi ba năng lực kia được nối dây. */
export function createRuleReportGateway(seed: RuleReportGatewaySeed = {}): RuleReportGateway {
  return {
    readCapabilities: (canEdit) => ({
      ...RULE_REPORT_MISSING_CAPABILITIES,
      canEdit: seed.canEdit ?? canEdit,
    }),
  };
}
