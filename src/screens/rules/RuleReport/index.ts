/**
 * Màn `ROUTE_PATTERNS.projectRules` — báo cáo kết quả kiểm tra luật không gian
 * của một dự án. Đường nhập duy nhất của thư mục này.
 *
 * - {@link RulesRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link RuleReportContainer} là màn đã nối, cho một chủ khác muốn nhúng nó
 *   với `projectId` đã biết sẵn (R-73).
 * - {@link RuleReport} là markup thuần, cho story và test.
 *
 * `RuleReportViewProps` (và mọi kiểu con của nó) có đúng **một** nơi định
 * nghĩa — `./types` — mà cả hook lẫn view cùng nhập; barrel này chỉ tái xuất,
 * không chép lại hình dạng.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { RuleReport } from './RuleReport';

export { RuleReportContainer, RulesRoute } from './RuleReport.container';
export type { RuleReportContainerProps } from './RuleReport.container';

export { useRuleReport } from './useRuleReport';
export type { UseRuleReportOptions } from './useRuleReport';

export type {
  PassedRule,
  RuleReportCapabilities,
  RuleReportFilters,
  RuleReportGroup,
  RuleReportLevelFilter,
  RuleReportRow,
  RuleReportStatus,
  RuleReportSummary,
  RuleReportViewProps,
  RuleRunProgress,
  SkippedRuleGroup,
} from './types';
