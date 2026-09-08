/**
 * Màn `ROUTE_PATTERNS.projectRuleSettings` — chỉnh bộ luật kiểm tra không gian
 * của một dự án. Đường nhập duy nhất của thư mục này.
 *
 * - {@link RuleSettingsRoute} là thứ `src/routes/router.tsx` mount.
 * - {@link RuleSettingsContainer} là màn đã nối, cho một chủ khác muốn nhúng nó
 *   với `projectId` đã biết sẵn (R-73).
 * - {@link RuleSettings} là markup thuần, cho story và test.
 *
 * `RuleSettingsProps` (và mọi kiểu con của nó) có đúng **một** nơi định nghĩa —
 * `./types` — mà cả hook lẫn view cùng nhập; barrel này chỉ tái xuất, không
 * chép lại hình dạng.
 *
 * Chuỗi tiếng Việt viết thẳng vào TS/TSX; `src/i18n/vi.json` là từ điển để
 * `lib/testing/expectVietnamese.ts` soát, không phải bảng dịch lúc chạy.
 */

export { RuleSettings } from './RuleSettings';

export { RuleSettingsContainer, RuleSettingsRoute } from './RuleSettings.container';
export type { RuleSettingsContainerProps } from './RuleSettings.container';

export { useRuleSettings, ruleSettingsQueryKey } from './useRuleSettings';
export type { RuleSettingsToast, UseRuleSettingsOptions } from './useRuleSettings';

export {
  createRuleSettingsGateway,
  resetRuleSettingsStore,
  RULE_SETTINGS_NOT_BUILT,
  RULE_SETTINGS_READ_ONLY_REASON,
} from './ruleSettingsGateway';
export type {
  ReadRuleConfigInput,
  RuleSettingsGateway,
  RuleSettingsGatewaySeed,
  UpdateRuleConfigInput,
} from './ruleSettingsGateway';

export type {
  BuildingKind,
  RuleSettingsActions,
  RuleSettingsCapabilities,
  RuleSettingsGroup,
  RuleSettingsPresetOption,
  RuleSettingsProps,
  RuleSettingsRow,
  RuleSettingsStatus,
  RuleSettingsThreshold,
  RuleSettingsViewModel,
} from './types';
