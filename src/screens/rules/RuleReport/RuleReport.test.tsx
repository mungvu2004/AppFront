/**
 * Bộ kiểm của W3 cho màn `RuleReport` (S-33) — `ROUTE_PATTERNS.projectRules`.
 *
 * ## Vì sao nhiều import ở đây đi qua `import()` thay vì `import … from …`
 *
 * `./types`, `./RuleReport`, `./useRuleReport`, `./RuleReport.container` là việc
 * của ba worker khác (W1/W2/W4) và tại thời điểm viết file này CHƯA tồn tại
 * trong worktree của W3 — mỗi worker lớp 2 dựng trên nhánh riêng của mình rồi
 * lớp gộp mới ghép lại. Đã đo thật: một `import` TĨNH của một chuỗi không tồn
 * tại làm Vite sập lúc transform, và KHÔNG MỘT test nào trong cả file chạy được
 * — kể cả những test không đụng gì tới ba file đó (`Failed to resolve import
 * "./RuleReport" … Test Files 1 failed, Tests no tests`). Kể cả `import()` với
 * CHUỖI TĨNH cũng bị chặn y hệt, vì plugin phân tích import của Vite phân giải
 * cả `import()` động có chuỗi hằng ngay lúc transform.
 *
 * Cách duy nhất hoãn việc phân giải sang đúng lúc CHẠY (để một import hỏng chỉ
 * làm hỏng ĐÚNG một `it`, không kéo sập cả file) là giấu chuỗi đường dẫn sau một
 * biến, kèm `/* @vite-ignore *\/` — xem {@link importFromScreen}. Nhờ vậy các
 * test không phụ thuộc ba file kia (khẳng định số liệu thẳng từ `runRules`, quét
 * mã nguồn tìm tên luật viết cứng…) chạy và XANH ngay hôm nay; các test cần view
 * thật thì HỎNG RIÊNG LẺ với thông báo "Failed to resolve" — đúng nhóm (a) mà
 * nhiệm vụ yêu cầu tách ra, và không cần sửa gì ở đây khi lớp gộp đã có đủ ba
 * file: `import()` khi đó phân giải thật, không phải giả.
 *
 * `import type` (xoá hẳn lúc biên dịch, không để lại `import` nào lúc chạy) thì
 * an toàn dùng thẳng, kể cả trỏ vào `./types` chưa tồn tại — đã đo thật, không
 * làm sập file.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ALL_RULES, createDefaultRuleRegistry } from '@/domain/rules/defaults';
import { countBySeverity, sortBySeverity } from '@/domain/rules/healthScore';
import { RULE_SEVERITY_LABELS } from '@/domain/rules/registry';
import type { Rule, RuleCode, Violation } from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import { isEntityOfKind, normalizeSpatial } from '@/domain/spatial/normalize';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { expectAccessible } from '@/lib/testing/expectAccessible';
import { expectNoRawColor } from '@/lib/testing/expectNoRawColor';
import { expectSevenStates } from '@/lib/testing/expectSevenStates';
import { expectVietnamese } from '@/lib/testing/expectVietnamese';
import {
  CLEAN_BUILDING_SCENARIO,
  EMPTY_PROJECT_SCENARIO,
  VIOLATED_BUILDING_SCENARIO,
} from '@/lib/testing/fixtures';
import {
  SEVEN_STATES,
  createSevenStateScenarios,
  type SevenStateScenario,
} from '@/lib/testing/sevenStateScenarios';
import { ROUTES } from '@/routes/paths';

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

afterEach(() => {
  cleanup();
});

/* ==========================================================================
 * 0. Hạ tầng: nhập file cùng thư mục qua biến, không qua chuỗi tĩnh.
 * ========================================================================== */

/** Xem lời giải thích ở đầu file. */
async function importFromScreen<T>(specifier: string): Promise<T> {
  return import(/* @vite-ignore */ specifier) as Promise<T>;
}

async function loadRuleReportView(): Promise<ComponentType<RuleReportViewProps>> {
  const mod = await importFromScreen<{ RuleReport: ComponentType<RuleReportViewProps> }>(
    './RuleReport',
  );

  return mod.RuleReport;
}

interface RuleReportContainerLikeProps {
  readonly projectId?: string;
}

async function loadRuleReportContainer(): Promise<ComponentType<RuleReportContainerLikeProps>> {
  const mod = await importFromScreen<{
    RuleReportContainer: ComponentType<RuleReportContainerLikeProps>;
  }>('./RuleReport.container');

  return mod.RuleReportContainer;
}

/** Bọc `MemoryRouter` — mối nối `onViewRow`/hook dùng `useNavigate()` (mục 0-BIS.9). */
function renderRuleReport(
  RuleReportView: ComponentType<RuleReportViewProps>,
  props: RuleReportViewProps,
) {
  return render(
    <MemoryRouter>
      <RuleReportView {...props} />
    </MemoryRouter>,
  );
}

/* ==========================================================================
 * A. Số đo THẬT của bộ máy luật — không đụng tới file của worker khác,
 *    nên đây là phần PHẢI XANH ngay bây giờ (tiêu chí nghiệm thu D-13).
 * ========================================================================== */

const REGISTRY = createDefaultRuleRegistry();
const ENABLED_RULES = REGISTRY.listEnabled();

const NORMALIZED_VIOLATED = normalizeSpatial(VIOLATED_BUILDING_SCENARIO.graph);
const VIOLATED_RESULT = runRules(NORMALIZED_VIOLATED, { registry: REGISTRY });

const NORMALIZED_CLEAN = normalizeSpatial(CLEAN_BUILDING_SCENARIO.graph);
const CLEAN_RESULT = runRules(NORMALIZED_CLEAN, { registry: REGISTRY });

const NORMALIZED_EMPTY = normalizeSpatial(EMPTY_PROJECT_SCENARIO.graph);
const EMPTY_RESULT = runRules(NORMALIZED_EMPTY, { registry: REGISTRY });

describe('D-13 — số vi phạm THẬT từ runRules, không phải mảng viết tay của fixture', () => {
  it('ALL_RULES đăng ký 25 luật; createDefaultRuleRegistry() bật 23 (2 luật bị nhóm function thay thế)', () => {
    console.log(
      `[W3] ALL_RULES.length = ${String(ALL_RULES.length)} · số luật BẬT = ${String(ENABLED_RULES.length)}`,
    );

    expect(ALL_RULES.length).toBe(25);
    expect(ENABLED_RULES.length).toBe(23);
  });

  it('runRules trên VIOLATED_BUILDING_SCENARIO = 189, KHÁC mảng .violations viết tay (7) — sự thật phải ghi lại', () => {
    const runRulesCount = VIOLATED_RESULT.violations.length;
    const fixtureArrayCount = VIOLATED_BUILDING_SCENARIO.violations.length;

    console.log(
      `[W3] runRules(VIOLATED) = ${String(runRulesCount)} vi phạm · ` +
        `VIOLATED_BUILDING_SCENARIO.violations (viết tay) = ${String(fixtureArrayCount)}`,
    );

    // Con số THẬT của bộ máy luật — đây là nguồn màn RuleReport phải đọc.
    expect(runRulesCount).toBe(189);

    // Mảng viết tay trong fixture chỉ mô phỏng DUY NHẤT khiếm khuyết cố ý (7
    // tường bị làm mỏng) mà `createViolatedBuildingScenario()` thêm vào để chốt
    // health score = 44 cho test của `healthScore.ts`; nó không phải đầu ra của
    // `runRules` và KHÔNG BAO GIỜ được dùng làm nguồn hiển thị cho màn này —
    // bản thân bộ mẫu chuẩn (`createSampleBuilding()`) vốn đã tự vi phạm 182
    // luật khi chạy thật (xem test "CLEAN" bên dưới).
    expect(fixtureArrayCount).toBe(7);

    // Khẳng định tường minh: hai con số LỆCH nhau, và đó là chủ ý — nếu một
    // ngày nào đó chúng bằng nhau thì hoặc fixture đã đổi (cần cập nhật lại
    // 189/7 ở đây), hoặc RuleReport đang đọc nhầm `scenario.violations` thay vì
    // tự chạy bộ máy luật.
    expect(runRulesCount).not.toBe(fixtureArrayCount);
  });

  it('runRules trên CLEAN_BUILDING_SCENARIO = 182 (KHÔNG phải 0 — bộ mẫu chuẩn không "sạch")', () => {
    console.log(`[W3] runRules(CLEAN) = ${String(CLEAN_RESULT.violations.length)}`);

    expect(CLEAN_RESULT.violations.length).toBe(182);
  });

  it('runRules trên EMPTY_PROJECT_SCENARIO = 0', () => {
    console.log(`[W3] runRules(EMPTY) = ${String(EMPTY_RESULT.violations.length)}`);

    expect(EMPTY_RESULT.violations.length).toBe(0);
  });
});

describe('grep — không file sản phẩm nào trong thư mục màn viết cứng tên luật', () => {
  it('mọi tên luật hiển thị phải đến từ rule.name, không phải chuỗi chép tay', () => {
    const dir = 'src/screens/rules/RuleReport';
    const productionFiles = readdirSync(dir).filter(
      (name) =>
        (name.endsWith('.ts') || name.endsWith('.tsx')) &&
        !name.endsWith('.test.tsx') &&
        !name.endsWith('.stories.tsx'),
    );

    const ruleNames = ALL_RULES.map((rule) => rule.name);
    const offenders: string[] = [];

    for (const file of productionFiles) {
      const content = readFileSync(join(dir, file), 'utf8');

      for (const name of ruleNames) {
        if (
          content.includes(`'${name}'`) ||
          content.includes(`"${name}"`) ||
          content.includes(`\`${name}\``)
        ) {
          offenders.push(`${file}: "${name}"`);
        }
      }
    }

    console.log(
      `[W3] file sản phẩm quét được trong thư mục (${String(productionFiles.length)}): ` +
        `${productionFiles.length > 0 ? productionFiles.join(', ') : '(chưa có — worker khác chưa commit vào worktree này)'}`,
    );
    console.log(
      `[W3] tên luật viết cứng: ${offenders.length === 0 ? 'không có' : offenders.join(' · ')}`,
    );

    expect(offenders).toEqual([]);
  });

  it('không một mã màu thô nào trong cả thư mục màn (bao gồm chính test/stories này)', () => {
    expect(() => {
      expectNoRawColor('src/screens/rules/RuleReport');
    }).not.toThrow();
  });
});

/* ==========================================================================
 * B. Dựng props THẬT cho view thuần, từ dữ liệu runRules ở trên.
 *
 *    Đây là mã kiểm thử (giống hệt tinh thần `vmFor` của
 *    `AccountSettings.test.tsx`), không phải mã sản phẩm: gộp theo luật ở đây
 *    là để có props hợp lệ cho `RuleReport`, không phải logic mà hook (W1)
 *    phải viết lại — hook vẫn phải tự dùng `groupViolationsByLevel` /
 *    `countBySeverity` / `sortBySeverity` của `healthScore.ts` như wiring.md
 *    mục 0-BIS.2 đòi hỏi.
 * ========================================================================== */

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

function toRow(violation: Violation, normalized: NormalizedSpatial): RuleReportRow {
  return {
    key: `${violation.ruleCode}:${violation.entityId}`,
    ruleCode: violation.ruleCode,
    severity: violation.severity,
    message: violation.message,
    suggestion: violation.suggestion,
    entityId: violation.entityId,
    levelId: violation.levelId,
    levelLabel: levelLabelOf(violation.levelId, normalized),
    resolved: false,
  };
}

function toGroups(
  violations: readonly Violation[],
  normalized: NormalizedSpatial,
): readonly RuleReportGroup[] {
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
      rows: ruleViolations.map((violation) => toRow(violation, normalized)),
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

const BASE_FILTERS: RuleReportFilters = { level: 'all', group: 'all', levelId: 'all' };

/** Sự thật hôm nay (mục 0-BIS.8): cả ba năng lực đều bị gỡ. */
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

/** Một `RuleReportViewProps` hợp lệ cho mỗi kịch bản trong bảy trạng thái chung. */
function propsFor(scenario: SevenStateScenario): RuleReportViewProps {
  const base: RuleReportViewProps = {
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
    onFilterChange: vi.fn(),
    onToggleGroup: vi.fn(),
    onSelectRow: vi.fn(),
    onViewRow: vi.fn(),
    onRerun: vi.fn(),
    onConfirmResolved: vi.fn(),
    previewRef: vi.fn(),
  };

  if (scenario.state === 'empty') {
    return base;
  }

  if (scenario.state === 'loading') {
    return { ...base, status: 'loading' };
  }

  if (scenario.state === 'forbidden') {
    return {
      ...base,
      status: 'forbidden',
      capabilities: { ...BASE_CAPABILITIES, canEdit: false },
    };
  }

  if (scenario.state === 'error') {
    return {
      ...base,
      status: 'error',
      errorMessage: 'Không chạy được kiểm tra luật. Thử lại sau ít phút.',
    };
  }

  if (scenario.state === 'partial') {
    const groups = toGroups(VIOLATED_RESULT.violations, NORMALIZED_VIOLATED);

    return {
      ...base,
      status: 'partial',
      summary: toSummary(VIOLATED_RESULT.violations),
      groups,
      passedRules: toPassedRules(VIOLATED_RESULT.violations),
      skipped: [SAMPLE_SKIPPED],
      expandedRuleCodes: groups.slice(0, 1).map((group) => group.ruleCode),
      lastRunLabel: 'vừa xong',
    };
  }

  // 'success' và 'collapsed' dùng chung một kết quả đầy đủ ('ready' vì
  // VIOLATED_RESULT còn vi phạm); 'collapsed' chỉ khác ở isCompact (mục
  // 0-BIS.8 — trạng thái 7 ẩn panel xem trước, bảng thành thẻ).
  const groups = toGroups(VIOLATED_RESULT.violations, NORMALIZED_VIOLATED);

  return {
    ...base,
    status: 'ready',
    summary: toSummary(VIOLATED_RESULT.violations),
    groups,
    passedRules: toPassedRules(VIOLATED_RESULT.violations),
    lastRunLabel: 'vừa xong',
    expandedRuleCodes: groups.slice(0, 1).map((group) => group.ruleCode),
    isCompact: scenario.state === 'collapsed',
  };
}

function scenarioOf(state: SevenStateScenario['state']): SevenStateScenario {
  const found = createSevenStateScenarios().find((candidate) => candidate.state === state);

  if (found === undefined) {
    throw new Error(`bộ kịch bản không có trạng thái "${state}"`);
  }

  return found;
}

/* ==========================================================================
 * C. Bảy trạng thái (A11 / R-63) — cần `RuleReport` thật, nên nhóm (a) hôm nay.
 * ========================================================================== */

describe('A11 — bảy trạng thái của RuleReport', () => {
  it('dựng đủ bảy, không trạng thái nào ra màn trắng', async () => {
    const RuleReportView = await loadRuleReportView();
    const covered: string[] = [];

    expectSevenStates((scenario) => {
      covered.push(scenario.label);

      return renderRuleReport(RuleReportView, propsFor(scenario));
    }, createSevenStateScenarios());

    console.log(
      `[W3] expectSevenStates = ${String(covered.length)}/${String(SEVEN_STATES.length)} — ${covered.join(', ')}`,
    );

    expect(covered).toHaveLength(SEVEN_STATES.length);
  });

  it('trạng thái "đang tải" và "thành công" không vẽ ra cùng một cây', async () => {
    const RuleReportView = await loadRuleReportView();

    const loading = renderRuleReport(RuleReportView, propsFor(scenarioOf('loading')));
    const loadingHtml = loading.container.innerHTML;

    loading.unmount();

    const success = renderRuleReport(RuleReportView, propsFor(scenarioOf('success')));

    expect(success.container.innerHTML).not.toEqual(loadingHtml);
  });
});

/* ==========================================================================
 * D. Tiếp cận được, tiếng Việt có dấu, nhãn mức độ đúng RULE_SEVERITY_LABELS.
 * ========================================================================== */

describe('R-72 — expectAccessible và expectVietnamese trên cây render thật', () => {
  it('trạng thái "ready" tiếp cận được và toàn chữ tiếng Việt có dấu', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    const { container } = renderRuleReport(RuleReportView, props);

    // Mã đối tượng (W-WALL0000000…) là mã kỹ thuật viết hoa, được
    // `expectVietnamese` chấp nhận (xem ui.md mục A về Table) — đó không phải
    // một từ tiếng Anh.
    //
    // `Level 0`…`Level 3` thì có. Chúng KHÔNG phải chữ của màn: `levelLabel` là
    // TÊN TẦNG đọc nguyên văn từ đồ thị (`levelNamesOf` → `entity.name`), và bộ
    // mẫu dùng chung của repo sinh tên tầng bằng tiếng Anh
    // (`src/lib/testing/fixtures.ts:186` — `name: ` + backtick + `Level ${index}`).
    // Màn không được tự đặt tên tầng, y như không được viết lại câu mô tả; dữ
    // liệu thật có tên tầng tiếng Việt thì màn hiện tiếng Việt. Nên bỏ qua ĐÚNG
    // chuỗi đó, neo hai đầu — không nới rộng hơn một ký tự nào.
    expectVietnamese(container, { ignore: [/^Level \d+$/] });
    expectAccessible(container);
  });

  it('chip mức độ dùng nguyên văn RULE_SEVERITY_LABELS, không tự đặt nhãn khác', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    const { container } = renderRuleReport(RuleReportView, props);
    const text = container.textContent ?? '';
    const usedSeverities = new Set(props.groups.map((group) => group.severity));

    expect(usedSeverities.size).toBeGreaterThan(0);

    for (const severity of usedSeverities) {
      expect(text).toContain(RULE_SEVERITY_LABELS[severity]);
    }
  });
});

/* ==========================================================================
 * E. Điều hướng — hook dùng useNavigate(), nên container đòi Router thật.
 * ========================================================================== */

describe('mục 0-BIS.9 — hook dùng useNavigate(), bắt buộc bọc MemoryRouter', () => {
  /**
   * Ngoài Router, `useNavigate()` trong hook ném lỗi — nhưng lỗi đó KHÔNG nổi
   * ra ngoài `render()`, vì R-62 buộc container bọc `ScreenErrorBoundary` và
   * ranh giới bắt lại đúng lỗi này. Nên phép kiểm là: ngoài Router thì ra phần
   * dự phòng của ranh giới lỗi, KHÔNG ra báo cáo. Điều cần chứng minh (hook đòi
   * Router thật) vẫn được chứng minh, và chứng minh thêm rằng ranh giới lỗi làm
   * đúng việc. Gỡ `ScreenErrorBoundary` để phép cũ (`toThrow()`) xanh lại là vi
   * phạm R-62, nên không làm.
   */
  it('dựng RuleReportContainer ngoài Router thì ra phần dự phòng của ranh giới lỗi, không ra báo cáo', async () => {
    const RuleReportContainer = await loadRuleReportContainer();

    // React in lỗi đã bắt được ra console; im nó đi để bảng kết quả đọc được.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(<RuleReportContainer projectId="P-000001" />);
    } finally {
      consoleError.mockRestore();
    }

    // Không có báo cáo: đầu đề của màn không được dựng.
    expect(screen.queryByRole('heading', { name: 'Kiểm tra luật không gian' })).toBeNull();
    // Mà có phần dự phòng của ranh giới lỗi, dựng bằng `EmptyState` từ
    // `report.description` (R-62). Lỗi này không thử lại được nên phần dự phòng
    // KHÔNG có nút — cái nhìn thấy được là đầu đề của nó.
    expect(screen.getByRole('heading', { name: 'Có trục trặc' })).toBeTruthy();
  });

  it('bọc trong MemoryRouter thì dựng được, không ném lỗi', async () => {
    const RuleReportContainer = await loadRuleReportContainer();

    expect(() =>
      render(
        <MemoryRouter>
          <RuleReportContainer projectId="P-000001" />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});

/* ==========================================================================
 * F. Ba năng lực bị gỡ (0-BIS.1, 0-BIS.2, 0-BIS.8) — không nút, không panel.
 * ========================================================================== */

describe('năng lực bị gỡ thì bị gỡ khỏi DOM, không render nút vô hiệu hoá', () => {
  it('canAutoFix=false: không nút "sửa tự động" nào trong DOM', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    renderRuleReport(RuleReportView, props);

    expect(screen.queryByRole('button', { name: /sửa tự động/i })).toBeNull();
  });

  it('canDismiss=false: không nút "bỏ qua" nào trong DOM', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    renderRuleReport(RuleReportView, props);

    expect(screen.queryByRole('button', { name: /bỏ qua/i })).toBeNull();
  });

  it('canPreview3d=false: không panel xem trước 3D (không canvas nào trong DOM)', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    const { container } = renderRuleReport(RuleReportView, props);

    expect(container.querySelector('canvas')).toBeNull();
  });
});

/* ==========================================================================
 * G. Màu chỉ là chip nhỏ và chấm — CẤM TUYỆT ĐỐI dải đỏ lớn.
 *
 *    jsdom không dựng layout thật nên không đo được diện tích theo px (mọi
 *    `getBoundingClientRect()` trả về 0). Phép đo dưới đây là GIÁN TIẾP: đếm số
 *    phần tử mang token màu vi phạm và kiểm lớp của chúng có hình dạng chip/
 *    chấm (`h-[22px]` của Badge, hoặc `rounded-full` của chấm) — không khẳng
 *    định đã đo diện tích thật. Đã ghi rõ điều này trong `worker_done`.
 * ========================================================================== */

describe('CẤM TUYỆT ĐỐI — đỏ chỉ xuất hiện dưới dạng chip nhỏ và chấm', () => {
  it('phần tử mang token màu vi phạm ít, và đều có hình dạng chip/chấm (phép đo gián tiếp)', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    const { container } = renderRuleReport(RuleReportView, props);

    const violationColored = [
      ...container.querySelectorAll<HTMLElement>('[class*="state-violation"]'),
    ];
    const criticalRowCount = VIOLATED_RESULT.violations.filter(
      (violation) => violation.severity === 'critical',
    ).length;

    console.log(
      `[W3] phần tử mang màu "state-violation" trong DOM = ${String(violationColored.length)} · ` +
        `số hàng critical thật = ${String(criticalRowCount)} (phép đo gián tiếp qua tên lớp, không phải diện tích px)`,
    );

    expect(violationColored.length).toBeGreaterThan(0);
    // Nhỏ: tối đa một chip + một chấm cho mỗi hàng nghiêm trọng, không phải một
    // dải phủ độc lập với số hàng.
    expect(violationColored.length).toBeLessThanOrEqual(criticalRowCount * 2);

    for (const element of violationColored) {
      // `\b` ở CUỐI không bao giờ khớp được: sau `]` là dấu cách, cả hai đều
      // không phải ký tự từ, nên không có ranh giới từ ở đó — biểu thức cũ
      // không thể xanh dù mã đúng hay sai. Bỏ đúng dấu `\b` cuối, giữ nguyên
      // điều đang cần chứng minh: phần tử mang màu vi phạm phải là chip
      // (`h-[22px]` của `Badge`) hoặc chấm (`rounded-full`).
      const looksLikeChipOrDot =
        /\bh-\[22px\]/.test(element.className) || /\brounded-full\b/.test(element.className);

      expect(
        looksLikeChipOrDot,
        `phần tử mang màu vi phạm không giống chip/chấm: class="${element.className}"`,
      ).toBe(true);
    }

    // Không dải đỏ lớn ngang trang: không phần tử nào vừa mang màu vi phạm vừa
    // trải hết chiều ngang.
    expect(container.querySelectorAll('[class*="state-violation"][class*="w-full"]').length).toBe(
      0,
    );
  });
});

/* ==========================================================================
 * H. Câu mô tả không bị viết lại (0-BIS.2 + types.ts: "CẤM viết lại, CẤM định
 *    dạng lại"), và mục đã xử lý còn nhìn thấy trong nhóm gộp (CẤM TUYỆT ĐỐI).
 * ========================================================================== */

describe('câu mô tả lấy nguyên văn từ violation.message, không bị viết lại', () => {
  it('row.message xuất hiện NGUYÊN VĂN trong DOM', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    const sampleMessage = props.groups[0]?.rows[0]?.message;

    if (sampleMessage === undefined) {
      throw new Error('không có hàng mẫu để kiểm — propsFor lỗi');
    }

    renderRuleReport(RuleReportView, props);

    expect(screen.getByText(sampleMessage)).toBeTruthy();
  });
});

describe('mục đã xử lý phải còn nhìn thấy trong nhóm gộp (CẤM TUYỆT ĐỐI)', () => {
  it('hàng resolved=true trong resolvedRows vẫn xuất hiện trong DOM', async () => {
    const RuleReportView = await loadRuleReportView();
    const props = propsFor(scenarioOf('success'));
    const firstGroup = props.groups[0];
    const firstRow = firstGroup?.rows[0];

    if (firstGroup === undefined || firstRow === undefined) {
      throw new Error('không có hàng mẫu để kiểm — propsFor lỗi');
    }

    const resolvedRow: RuleReportRow = { ...firstRow, resolved: true };
    const withResolved: RuleReportViewProps = {
      ...props,
      groups: props.groups.map((group) =>
        group.ruleCode === firstGroup.ruleCode
          ? { ...group, rows: group.rows.slice(1), resolvedCount: 1 }
          : group,
      ),
      resolvedRows: [resolvedRow],
    };

    renderRuleReport(RuleReportView, withResolved);

    expect(screen.getByText(resolvedRow.message)).toBeTruthy();
  });
});
