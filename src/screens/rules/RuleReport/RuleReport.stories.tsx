/**
 * Bảy trạng thái của {@link RuleReport} (A11 / R-63): rỗng, đang tải, một phần,
 * lỗi, xong, không có quyền, thu gọn.
 *
 * Mọi story dựng view thuần — không hook, không cổng, không mạng — bằng `args`
 * tĩnh, đúng khuôn `AccountSettings.stories.tsx` (tên export ASCII, English —
 * mục B/E.11 của CLAUDE.md; nhãn tiếng Việt của từng trạng thái nằm trong chú
 * thích ngay trên mỗi story, cùng quy ước).
 *
 * Dữ liệu mẫu KHÔNG viết cứng tên luật: nó tính từ một lượt `runRules()` thật
 * trên `VIOLATED_BUILDING_SCENARIO` (bộ mẫu chuẩn A14), rồi lấy
 * `rule.name`/`violation.message`/`violation.suggestion` nguyên văn — cùng cách
 * `RuleReport.test.tsx` dựng props, để hai file không kể hai câu chuyện khác
 * nhau về cùng một màn. `RuleReport.test.tsx` cố ý KHÔNG nhập lại file này (và
 * ngược lại): mỗi file tự tính dữ liệu mẫu của nó từ cùng một nguồn thật.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { createDefaultRuleRegistry, ALL_RULES } from '@/domain/rules/defaults';
import { countBySeverity, sortBySeverity } from '@/domain/rules/healthScore';
import type { Rule, RuleCode, Violation } from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import { isEntityOfKind, normalizeSpatial } from '@/domain/spatial/normalize';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { VIOLATED_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { ROUTES } from '@/routes/paths';

import { RuleReport } from './RuleReport';
import type {
  PassedRule,
  RuleReportCapabilities,
  RuleReportFilters,
  RuleReportGroup,
  RuleReportRow,
  RuleReportSummary,
  RuleReportViewProps,
  SkippedRuleGroup,
} from './types';

const meta = {
  title: 'Screens/Rules/RuleReport',
  component: RuleReport,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof RuleReport>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

/* -------------------------------------------------------------------------- */
/* Dữ liệu mẫu — một lượt runRules() thật, không mảng .violations viết tay.    */
/* -------------------------------------------------------------------------- */

const REGISTRY = createDefaultRuleRegistry();
const ENABLED_RULES = REGISTRY.listEnabled();
const NORMALIZED = normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph);
const RESULT = runRules(NORMALIZED, { registry: REGISTRY });

function ruleOf(code: RuleCode): Rule {
  const rule = ALL_RULES.find((candidate) => candidate.code === code);

  if (rule === undefined) {
    throw new Error(`không tìm thấy luật "${code}" trong ALL_RULES`);
  }

  return rule;
}

function levelLabelOf(levelId: LevelId | null, normalized: NormalizedSpatial): string | null {
  if (levelId === null) {
    return null;
  }

  const entity = normalized.byId[levelId];

  return entity !== undefined && isEntityOfKind('level', entity) ? entity.name : levelId;
}

function toRow(violation: Violation): RuleReportRow {
  return {
    key: `${violation.ruleCode}:${violation.entityId}`,
    ruleCode: violation.ruleCode,
    severity: violation.severity,
    message: violation.message,
    suggestion: violation.suggestion,
    entityId: violation.entityId,
    levelId: violation.levelId,
    levelLabel: levelLabelOf(violation.levelId, NORMALIZED),
    resolved: false,
  };
}

function toGroups(violations: readonly Violation[]): readonly RuleReportGroup[] {
  const byRule = new Map<RuleCode, Violation[]>();

  for (const violation of sortBySeverity(violations)) {
    const bucket = byRule.get(violation.ruleCode);

    if (bucket === undefined) {
      byRule.set(violation.ruleCode, [violation]);
    } else {
      bucket.push(violation);
    }
  }

  return [...byRule.entries()].map(([ruleCode, ruleViolations]) => {
    const rule = ruleOf(ruleCode);

    return {
      ruleCode,
      ruleName: rule.name,
      group: rule.group,
      severity: rule.severity,
      rows: ruleViolations.map(toRow),
      openCount: ruleViolations.length,
      resolvedCount: 0,
    };
  });
}

function toSummary(violations: readonly Violation[]): RuleReportSummary {
  const counts = countBySeverity(violations);
  const rulesWithFindings = new Set(violations.map((violation) => violation.ruleCode));

  return {
    evaluated: ENABLED_RULES.length,
    passed: ENABLED_RULES.length - rulesWithFindings.size,
    warnings: counts.warning + counts.suggestion,
    violations: counts.critical,
  };
}

function toPassedRules(violations: readonly Violation[]): readonly PassedRule[] {
  const rulesWithFindings = new Set(violations.map((violation) => violation.ruleCode));

  return ENABLED_RULES.filter((rule) => !rulesWithFindings.has(rule.code)).map((rule) => ({
    ruleCode: rule.code,
    ruleName: rule.name,
    group: rule.group,
  }));
}

const ALL_GROUPS = toGroups(RESULT.violations);

/** Hai nhóm đầu — story "một phần" minh hoạ lúc phần còn lại chưa chạy được. */
const PARTIAL_RULE_CODES = new Set(ALL_GROUPS.slice(0, 2).map((group) => group.ruleCode));
const PARTIAL_VIOLATIONS = RESULT.violations.filter((violation) =>
  PARTIAL_RULE_CODES.has(violation.ruleCode),
);
const PARTIAL_GROUPS = toGroups(PARTIAL_VIOLATIONS);

const BASE_FILTERS: RuleReportFilters = { level: 'all', group: 'all', levelId: 'all' };

/** Sự thật hôm nay (mục 0-BIS.1/.2/.8 của contract.md): cả ba năng lực đều bị gỡ. */
const BASE_CAPABILITIES: RuleReportCapabilities = {
  canAutoFix: false,
  canDismiss: false,
  canEdit: true,
  canPreview3d: false,
};

const SAMPLE_SKIPPED: SkippedRuleGroup = {
  group: 'circulation',
  reason: 'Chưa đủ dữ liệu cửa đi ở tầng này để chạy nhóm luật lưu thông.',
  remedyPath: ROUTES.project.upload('P-000001'),
  remedyLabel: 'bổ sung bản vẽ',
};

/** Props nền — mọi story ghi đè từ đây, giống hệt props rỗng thật của trạng thái 1. */
const EMPTY_PROPS: RuleReportViewProps = {
  status: 'empty',
  summary: { evaluated: 0, passed: 0, warnings: 0, violations: 0 },
  groups: [],
  resolvedRows: [],
  passedRules: [],
  skipped: [],
  filters: BASE_FILTERS,
  capabilities: BASE_CAPABILITIES,
  // 0-BIS.6: không có API tiến độ theo luật đã chạy — trường này LUÔN null.
  progress: null,
  lastRunLabel: null,
  selectedRowKey: null,
  expandedRuleCodes: [],
  isFiltered: false,
  isCompact: false,
  errorMessage: null,
  onFilterChange: noop,
  onToggleGroup: noop,
  onSelectRow: noop,
  onViewRow: noop,
  onRerun: noop,
  onConfirmResolved: noop,
  previewRef: noop,
};

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (tên export ASCII — mục B/E.11; nhãn tiếng Việt trong chú     */
/* thích, đúng khuôn AccountSettings.stories.tsx).                             */
/* -------------------------------------------------------------------------- */

/** 1 · rỗng — chưa chạy kiểm tra lần nào. */
export const Empty: Story = {
  args: EMPTY_PROPS,
};

/** 2 · đang tải — đang chạy `runRules`; hàng khung xương, không thanh tiến độ giả (0-BIS.6). */
export const Loading: Story = {
  args: { ...EMPTY_PROPS, status: 'loading' },
};

/** 3 · một phần — hai nhóm đã chạy, một nhóm luật lưu thông chưa đủ dữ liệu (0-BIS: skipped). */
export const Partial: Story = {
  args: {
    ...EMPTY_PROPS,
    status: 'partial',
    summary: toSummary(PARTIAL_VIOLATIONS),
    groups: PARTIAL_GROUPS,
    passedRules: [],
    skipped: [SAMPLE_SKIPPED],
    expandedRuleCodes: PARTIAL_GROUPS.slice(0, 1).map((group) => group.ruleCode),
    lastRunLabel: 'vừa xong',
  },
};

/** 4 · lỗi — không chạy được kiểm tra luật. */
export const ErrorState: Story = {
  args: {
    ...EMPTY_PROPS,
    status: 'error',
    errorMessage: 'Không chạy được kiểm tra luật. Thử lại sau ít phút.',
  },
};

/** 5 · xong — đã chạy đủ 23 luật bật, còn vi phạm (bộ mẫu chuẩn A14 vốn không "sạch"). */
export const Success: Story = {
  args: {
    ...EMPTY_PROPS,
    status: 'ready',
    summary: toSummary(RESULT.violations),
    groups: ALL_GROUPS,
    passedRules: toPassedRules(RESULT.violations),
    expandedRuleCodes: ALL_GROUPS.slice(0, 1).map((group) => group.ruleCode),
    lastRunLabel: 'vừa xong',
  },
};

/** 6 · không có quyền — người xem không có quyền sửa dự án này. */
export const Forbidden: Story = {
  args: {
    ...EMPTY_PROPS,
    status: 'forbidden',
    capabilities: { ...BASE_CAPABILITIES, canEdit: false },
  },
};

/** 7 · thu gọn — vỏ ứng dụng báo màn đang hẹp: ẩn panel xem trước, bảng thành thẻ. */
export const Collapsed: Story = {
  args: {
    ...EMPTY_PROPS,
    status: 'ready',
    summary: toSummary(RESULT.violations),
    groups: ALL_GROUPS,
    passedRules: toPassedRules(RESULT.violations),
    expandedRuleCodes: ALL_GROUPS.slice(0, 1).map((group) => group.ruleCode),
    lastRunLabel: 'vừa xong',
    isCompact: true,
  },
};
