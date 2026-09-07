/**
 * Từ điển kiểu của màn báo cáo luật (S-33) — nguồn sự thật cho cả bốn worker.
 *
 * `useRuleReport.ts` dựng ra {@link RuleReportViewProps}; `RuleReport.tsx` chỉ
 * nhận đúng bộ đó và không được nhập `@/api`, `@/store`, `@/domain` hay
 * `@/lib/http` (R-60). Mọi câu chữ hiển thị đã được định dạng sẵn ở hook, đúng
 * bất biến A15: view chỉ in ra.
 *
 * Ba năng lực trên {@link RuleReportCapabilities} hiện là `false` và đó là sự
 * thật của repo hôm nay, không phải chỗ tạm — xem `ruleReportGateway.ts`.
 */

import type { RuleCode, RuleGroup, RuleSeverity } from '@/domain/rules/registry';
import type { LevelId } from '@/domain/spatial/types';

/** Một hàng trong danh sách — đúng một vi phạm. */
export interface RuleReportRow {
  /**
   * Khoá ổn định: `${ruleCode}:${entityId}`.
   *
   * Một luật có thể soi ra NHIỀU lỗi trên CÙNG một đối tượng — `WALL-DANGLING-END`
   * cho hai vi phạm trên một bức tường vì tường có hai đầu — nên hai hàng có thể
   * trùng đúng cặp đó. Hàng thứ hai trở đi được nối thêm `#2`, `#3`… để khoá luôn
   * là duy nhất trong một lượt chạy. Hàng đầu tiên giữ nguyên dạng đã hẹn.
   */
  readonly key: string;
  readonly ruleCode: RuleCode;
  readonly severity: RuleSeverity;
  /** Câu mô tả LẤY NGUYÊN VĂN từ `violation.message`. CẤM viết lại, CẤM định dạng lại. */
  readonly message: string;
  /** Câu việc-cần-làm, nguyên văn từ `violation.suggestion`. */
  readonly suggestion: string;
  /** Mã đối tượng, hiện bằng chữ đều (mono). */
  readonly entityId: string;
  readonly levelId: LevelId | null;
  /** Nhãn tầng để người đọc; null nếu là luật toàn nhà. */
  readonly levelLabel: string | null;
  /** Đã được người dùng đánh dấu xử lý trong phiên này. */
  readonly resolved: boolean;
}

/** Một nhóm — một luật, kèm mọi hàng của nó. */
export interface RuleReportGroup {
  readonly ruleCode: RuleCode;
  /** Tên luật tiếng Việt LẤY TỪ `rule.name` của sổ đăng ký. CẤM viết cứng tên luật trong màn. */
  readonly ruleName: string;
  readonly group: RuleGroup;
  readonly severity: RuleSeverity;
  readonly rows: readonly RuleReportRow[];
  readonly openCount: number;
  readonly resolvedCount: number;
}

/** Bốn con số trần của dải tóm tắt. */
export interface RuleReportSummary {
  readonly evaluated: number;
  readonly passed: number;
  readonly warnings: number;
  readonly violations: number;
}

export type RuleReportLevelFilter = 'all' | 'violation' | 'warning' | 'passed';

export interface RuleReportFilters {
  readonly level: RuleReportLevelFilter;
  readonly group: RuleGroup | 'all';
  readonly levelId: LevelId | 'all';
}

/** Luật đã chạy xong mà không ra lỗi nào — ô lọc "Đạt" hiện danh sách này. */
export interface PassedRule {
  readonly ruleCode: RuleCode;
  readonly ruleName: string;
  readonly group: RuleGroup;
}

/** Một nhóm luật không chạy được vì thiếu dữ liệu — trạng thái "Một phần". */
export interface SkippedRuleGroup {
  readonly group: RuleGroup;
  /** Câu tiếng Việt nói vì sao không chạy được. */
  readonly reason: string;
  /** Đường dẫn màn S-20 để người dùng đi bổ sung; lấy từ `@/routes/paths`. */
  readonly remedyPath: string;
  readonly remedyLabel: string;
}

/**
 * Năng lực còn thiếu ở tầng logic. Cả ba hiện là `false` và đó là SỰ THẬT của
 * repo hôm nay, không phải chỗ tạm. Xem `ruleReportGateway.ts`.
 */
export interface RuleReportCapabilities {
  readonly canAutoFix: boolean;
  readonly canDismiss: boolean;
  /**
   * Panel xem trước 3D có dựng được không. `false` ở bản này: `mountPresentation`
   * đòi một `PresentationPlan` mà repo chưa có bộ đổi từ `NormalizedSpatial`, và
   * `PresentationHandle` không có API camera nào nhận `entityId`.
   * Khi `false`, view KHÔNG render panel 344px — danh sách ăn hết bề ngang.
   */
  readonly canPreview3d: boolean;
  /** Người dùng có quyền sửa không (trạng thái 6). */
  readonly canEdit: boolean;
}

export type RuleReportStatus =
  | 'empty'      // chưa chạy kiểm tra
  | 'loading'    // đang chạy
  | 'partial'    // chỉ một phần tầng đủ dữ liệu, hoặc có nhóm luật không chạy được
  | 'error'
  | 'ready'      // đã chạy, còn vi phạm
  | 'done'       // đã chạy, không còn vi phạm
  | 'forbidden'; // không có quyền

/** Tiến độ khi đang chạy: theo SỐ LUẬT đã chạy, không phải phần trăm bịa. */
export interface RuleRunProgress {
  readonly ranCount: number;
  readonly totalCount: number;
}

/** DUY NHẤT thứ view nhận. View KHÔNG được nhập `@/api`, `@/store`, `@/domain`, `@/lib/http`. */
export interface RuleReportViewProps {
  readonly status: RuleReportStatus;
  readonly summary: RuleReportSummary;
  readonly groups: readonly RuleReportGroup[];
  readonly resolvedRows: readonly RuleReportRow[];
  readonly passedRules: readonly PassedRule[];
  readonly skipped: readonly SkippedRuleGroup[];
  readonly filters: RuleReportFilters;
  readonly capabilities: RuleReportCapabilities;
  readonly progress: RuleRunProgress | null;
  /** Nhãn thời điểm chạy lần cuối, ĐÃ định dạng sẵn ở hook. View chỉ in ra. */
  readonly lastRunLabel: string | null;
  readonly selectedRowKey: string | null;
  /** Các nhóm luật đang mở. */
  readonly expandedRuleCodes: readonly RuleCode[];
  /** Bộ lọc có đang thu hẹp kết quả không — để phân biệt "rỗng thật" với "lọc hết". */
  readonly isFiltered: boolean;
  /** Trạng thái 7: ẩn panel xem trước, bảng thành thẻ. */
  readonly isCompact: boolean;
  /** Thông báo lỗi đã dịch sẵn sang câu tiếng Việt. */
  readonly errorMessage: string | null;

  readonly onFilterChange: (next: RuleReportFilters) => void;
  readonly onToggleGroup: (ruleCode: RuleCode) => void;
  readonly onSelectRow: (rowKey: string) => void;
  /** "Xem" — mở S-32 và khuôn camera qua R-07. */
  readonly onViewRow: (rowKey: string) => void;
  readonly onRerun: () => void;
  /** Chỉ bật khi `summary.violations === 0`. */
  readonly onConfirmResolved: () => void;
  /**
   * Cho panel xem trước 344px. Hook truyền xuống một hàm gắn canvas.
   * View CHỈ gọi ref này, KHÔNG tự nhập three.js.
   */
  readonly previewRef: (canvas: HTMLCanvasElement | null) => void;
}
