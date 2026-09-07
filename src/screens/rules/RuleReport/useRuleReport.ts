/**
 * Toàn bộ logic của màn báo cáo luật (S-33).
 *
 * Hook này **nối lại** bộ máy luật đã có, không dựng thêm luật nào (R-61):
 *
 * - **Chạy kiểm tra** — `runRules(graph, { registry: createDefaultRuleRegistry() })`
 *   gọi thẳng. KHÔNG đi qua `RulesPort` / `createIncrementalRuleRunner`: hai thứ
 *   đó phục vụ pipeline dispatch lệnh (chúng đòi danh sách `changes` của lượt
 *   sửa vừa rồi), còn đây là một màn thuần đọc. `src/store/selectors.ts` cũng
 *   gọi thẳng như vậy.
 * - **Gộp và đếm** — `groupViolationsByLevel`, `countBySeverity` và
 *   `sortBySeverity` của `@/domain/rules/healthScore`. Không đếm tay, không gộp
 *   tay. Riêng gộp theo LUẬT (`ruleCode`) thì domain không có sẵn, nên
 *   {@link groupRowsByRule} tự viết theo đúng khuôn hình của
 *   `groupViolationsByLevel`: đó là việc ghép, không phải công thức tự chế.
 * - **Tên luật, câu mô tả, câu gợi ý** — lấy nguyên văn từ sổ đăng ký và từ
 *   `Violation`. Màn không viết cứng một tên luật nào, không định dạng lại một
 *   câu nào; `message` và `suggestion` do tầng domain sinh ra đã mang sẵn số kiểu
 *   Việt Nam (dấu chấm phân nghìn, dấu phẩy thập phân — A15).
 * - **Mọi con số suy ra lúc chạy.** Không viết cứng 14 / 23 / 25: sổ đăng ký
 *   khai 25 luật và tắt 2 luật bị nhóm chức năng thay thế, nhưng con số ấy là
 *   việc của domain — màn chỉ đếm những gì lượt chạy trả về.
 *
 * ## Trạng thái tải: không một `useState` nào (R-64)
 *
 * Lượt chạy đi qua `useQuery`, khoá `queryKeys.violation.byProject(projectId)`
 * nối thêm mã phiên bản của dữ liệu đang mở. Nhờ vậy: "đang chạy" và "lỗi" đến
 * thẳng từ query; nút "chạy lại" là `refetch`; và `invalidationMap.editWall` /
 * `editRoom` / `rerunRules` của `@/lib/query` — vốn đã vô hiệu hoá đúng khoá
 * này — tự làm báo cáo cũ đi sau mỗi lượt sửa mô hình, không cần màn tự canh.
 *
 * ## Ba thứ CỐ Ý không có ở bản này
 *
 * - **`progress` luôn `null`.** `runRules` là hàm đồng bộ, một lần gọi, trả kết
 *   quả đầy đủ; `evaluated` và `reusedTaskCount` chỉ đọc được SAU khi đã xong.
 *   Không có API báo tiến độ giữa chừng, nên một thanh tiến độ "đã chạy X/Y
 *   luật" sẽ là con số bịa. Trường vẫn nằm trong kiểu dữ liệu để sau này bật lên
 *   mà không phải sửa view.
 * - **Panel xem trước 3D.** `capabilities.canPreview3d` là `false`; xem
 *   `ruleReportGateway.ts` để biết chính xác thiếu gì. {@link useRuleReport} vẫn
 *   trả về `previewRef` để chữ ký không đổi, nhưng nó không lắp cảnh nào.
 * - **Thời lượng bay camera 340 ms** (`MOTION_DURATIONS_MS.slow`, đúng con số
 *   `PRESET_SETTINGS.transitionMs` của `@/lib/three/camera`) không có người gọi
 *   ở đây, vì cùng lý do trên. Thời lượng duy nhất màn này còn dùng là
 *   `MOTION_DURATIONS_MS.standard` cho khoảng chờ giữa hai lần thử lại — lấy từ
 *   thang, không viết số thô (R-71).
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createDefaultRuleRegistry } from '@/domain/rules/defaults';
import { countBySeverity, groupViolationsByLevel, sortBySeverity } from '@/domain/rules/healthScore';
import {
  RULE_GROUP_LABELS,
  type RuleCode,
  type RuleGroup,
  type RuleRegistry,
  type Violation,
} from '@/domain/rules/registry';
import { evaluatedRuleCodes, runRules } from '@/domain/rules/runner';
import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { LevelId } from '@/domain/spatial/types';
import { formatTimestamp } from '@/lib/format/datetime';
import { MOTION_DURATIONS_MS } from '@/lib/motion/tokens';
import { queryKeys } from '@/lib/query/queryKeys';
import { ROUTES } from '@/routes/paths';
import { useStore } from '@/store';

import { createRuleReportGateway, type RuleReportGateway } from './ruleReportGateway';
import type {
  PassedRule,
  RuleReportFilters,
  RuleReportGroup,
  RuleReportRow,
  RuleReportStatus,
  RuleReportSummary,
  RuleReportViewProps,
  SkippedRuleGroup,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chữ ký công khai.                                                           */
/* -------------------------------------------------------------------------- */

export interface UseRuleReportOptions {
  readonly projectId: string;
  /** Trạng thái 6: container truyền xuống quyền của người dùng. */
  readonly canEdit?: boolean;
  /** Trạng thái 7: vỏ ứng dụng báo đang thu gọn. */
  readonly isCompact?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Hằng và giá trị rỗng dùng chung.                                            */
/* -------------------------------------------------------------------------- */

/** Bộ lọc lúc mở màn: không thu hẹp gì cả. */
const DEFAULT_FILTERS: RuleReportFilters = Object.freeze({
  level: 'all',
  group: 'all',
  levelId: 'all',
});

const EMPTY_VIOLATIONS: readonly Violation[] = Object.freeze([]);
const EMPTY_ROWS: readonly RuleReportRow[] = Object.freeze([]);
const EMPTY_GROUPS: readonly RuleReportGroup[] = Object.freeze([]);
const EMPTY_PASSED: readonly PassedRule[] = Object.freeze([]);
const EMPTY_SKIPPED: readonly SkippedRuleGroup[] = Object.freeze([]);
const EMPTY_RULE_CODES: readonly RuleCode[] = Object.freeze([]);

/** Bốn số 0 — dải tóm tắt trước khi có lượt chạy nào. */
const EMPTY_SUMMARY: RuleReportSummary = Object.freeze({
  evaluated: 0,
  passed: 0,
  warnings: 0,
  violations: 0,
});

/** Câu báo lỗi của trạng thái 4. Bộ luật chạy tại chỗ nên không có lỗi mạng để dịch. */
const RUN_FAILED_MESSAGE = 'không chạy được bộ kiểm tra trên mô hình này.';

/* -------------------------------------------------------------------------- */
/* Một lượt chạy.                                                              */
/* -------------------------------------------------------------------------- */

/** Kết quả một lượt chạy, đã rút gọn còn đúng những gì màn đọc tới. */
interface RuleReportRun {
  /** Nguyên danh sách `runRules` trả về, không lọc, không sắp lại. */
  readonly violations: readonly Violation[];
  /** Mã những luật THẬT SỰ đã chạy lượt này, mỗi mã một lần. */
  readonly ranRuleCodes: readonly RuleCode[];
  readonly ranAtEpochMs: number;
}

/**
 * Chạy bộ luật đầy đủ trên đồ thị đang mở.
 *
 * Không truyền `previous` và `changes`: mỗi lượt là một lượt sạch, nên
 * `evaluatedRuleCodes` cho đúng danh sách luật đã chạy chứ không phải phần
 * chạy lại của một lượt tăng dần.
 */
const runReport = (graph: NormalizedSpatial, registry: RuleRegistry): RuleReportRun => {
  const result = runRules(graph, { registry });

  return {
    violations: result.violations,
    ranRuleCodes: evaluatedRuleCodes(result),
    ranAtEpochMs: Date.now(),
  };
};

/* -------------------------------------------------------------------------- */
/* Từ vi phạm sang hàng.                                                       */
/* -------------------------------------------------------------------------- */

/** Tên tầng theo mã, đọc từ chính đồ thị — màn không tự đặt tên tầng. */
const levelNamesOf = (graph: NormalizedSpatial | null): ReadonlyMap<LevelId, string> => {
  const names = new Map<LevelId, string>();

  if (graph === null) {
    return names;
  }

  for (const id of graph.byKind.level) {
    const entity = graph.byId[id];

    if (entity !== undefined && isEntityOfKind('level', entity)) {
      names.set(entity.id, entity.name);
    }
  }

  return names;
};

/** Hàng đã dựng, kèm đường tra ngược từ vi phạm sang hàng của nó. */
interface BuiltRows {
  readonly rows: readonly RuleReportRow[];
  readonly rowByViolation: ReadonlyMap<Violation, RuleReportRow>;
}

/**
 * Dựng hàng cho từng vi phạm, nặng trước nhẹ sau.
 *
 * Khoá là `${ruleCode}:${entityId}` như đã hẹn, nối thêm `#2`, `#3`… cho lần
 * xuất hiện thứ hai trở đi của cùng một cặp: một luật soi ra nhiều lỗi trên
 * cùng một đối tượng là chuyện thật (`WALL-DANGLING-END` báo cả hai đầu tường),
 * và hai hàng trùng khoá sẽ làm hỏng cả danh sách lẫn phép so hai lượt chạy.
 */
const buildRows = (
  violations: readonly Violation[],
  levelNames: ReadonlyMap<LevelId, string>,
): BuiltRows => {
  const seen = new Map<string, number>();
  const rows: RuleReportRow[] = [];
  const rowByViolation = new Map<Violation, RuleReportRow>();

  for (const violation of sortBySeverity(violations)) {
    const base = `${violation.ruleCode}:${violation.entityId}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);

    const row: RuleReportRow = {
      key: count === 1 ? base : `${base}#${String(count)}`,
      ruleCode: violation.ruleCode,
      severity: violation.severity,
      message: violation.message,
      suggestion: violation.suggestion,
      entityId: violation.entityId,
      levelId: violation.levelId,
      levelLabel: violation.levelId === null ? null : levelNames.get(violation.levelId) ?? null,
      resolved: false,
    };

    rows.push(row);
    rowByViolation.set(violation, row);
  }

  return { rows, rowByViolation };
};

/**
 * Gộp hàng theo LUẬT.
 *
 * Domain gộp sẵn theo tầng (`groupViolationsByLevel`) và đếm sẵn theo mức
 * (`countBySeverity`) nhưng không gộp theo luật, nên phép gộp này viết theo
 * đúng khuôn hình của hàm kia: giữ thứ tự nhóm theo lần đầu nhóm xuất hiện, để
 * hai lượt chạy ra cùng kết quả thì cũng ra cùng thứ tự.
 */
const groupRowsByRule = (
  rows: readonly RuleReportRow[],
  registry: RuleRegistry,
): readonly RuleReportGroup[] => {
  const byRule = new Map<RuleCode, RuleReportRow[]>();
  const order: RuleCode[] = [];

  for (const row of rows) {
    const bucket = byRule.get(row.ruleCode);

    if (bucket === undefined) {
      byRule.set(row.ruleCode, [row]);
      order.push(row.ruleCode);
    } else {
      bucket.push(row);
    }
  }

  const groups: RuleReportGroup[] = [];

  for (const ruleCode of order) {
    const bucket = byRule.get(ruleCode) ?? [];
    const rule = registry.get(ruleCode);

    if (rule === null) {
      continue;
    }

    groups.push({
      ruleCode,
      ruleName: rule.name,
      group: rule.group,
      severity: rule.severity,
      rows: bucket,
      openCount: bucket.filter((row) => !row.resolved).length,
      resolvedCount: bucket.filter((row) => row.resolved).length,
    });
  }

  return groups;
};

/* -------------------------------------------------------------------------- */
/* Luật không chạy được — trạng thái "một phần".                               */
/* -------------------------------------------------------------------------- */

/**
 * Những nhóm luật không chạy được lượt này, kèm đường đi bổ sung dữ liệu.
 *
 * Không đoán bằng `dependsOn`: một luật phạm vi `level` chỉ sinh ra công việc
 * khi mô hình CÓ tầng (`runner.ts`, `tasksOfRule`), nên "đã bật mà không có mặt
 * trong danh sách đã chạy" là bằng chứng thẳng thắn rằng nó không chạy được, và
 * lý do duy nhất khiến điều đó xảy ra là mô hình chưa có tầng nào.
 */
const skippedGroupsOf = (
  registry: RuleRegistry,
  ranRuleCodes: readonly RuleCode[],
  levelIds: readonly LevelId[],
  projectId: string,
): readonly SkippedRuleGroup[] => {
  const ran = new Set(ranRuleCodes);
  const countByGroup = new Map<RuleGroup, number>();
  const order: RuleGroup[] = [];

  for (const rule of registry.listEnabled()) {
    if (ran.has(rule.code)) {
      continue;
    }

    const seen = countByGroup.get(rule.group);

    if (seen === undefined) {
      countByGroup.set(rule.group, 1);
      order.push(rule.group);
    } else {
      countByGroup.set(rule.group, seen + 1);
    }
  }

  if (order.length === 0) {
    return EMPTY_SKIPPED;
  }

  const firstLevelId = levelIds[0];
  const remedy =
    firstLevelId === undefined
      ? { path: ROUTES.project.floors(projectId), label: 'thêm tầng cho mô hình' }
      : { path: ROUTES.project.rooms(projectId, firstLevelId), label: 'mở màn nhãn phòng' };

  return order.map((group) => ({
    group,
    reason: `nhóm ${RULE_GROUP_LABELS[group]}: ${String(
      countByGroup.get(group) ?? 0,
    )} luật chưa chạy được vì mô hình chưa có tầng nào để soi.`,
    remedyPath: remedy.path,
    remedyLabel: remedy.label,
  }));
};

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Trả về ĐÚNG bộ props của view, không thừa trường nào.
 *
 * Container chỉ việc:
 * `const props = useRuleReport({ projectId }); return <RuleReport {...props} />;`
 */
export function useRuleReport(options: UseRuleReportOptions): RuleReportViewProps {
  const { projectId, canEdit = true, isCompact = false } = options;

  const navigate = useNavigate();
  const gateway: RuleReportGateway = useMemo(() => createRuleReportGateway(), []);
  const capabilities = useMemo(() => gateway.readCapabilities(canEdit), [gateway, canEdit]);

  // Một sổ đăng ký riêng cho lượt xem này, dựng đúng một lần: bộ mặc định đã tự
  // tắt hai luật built-in bị nhóm chức năng thay thế, nên số luật là việc của
  // domain chứ không phải của màn.
  const registry = useMemo(() => createDefaultRuleRegistry(), []);

  const graph = useStore((state) => state.spatial);
  const spatialLoading = useStore((state) => state.spatialLoading);
  const versionId = useStore((state) => state.versionId);

  const [filters, setFilters] = useState<RuleReportFilters>(DEFAULT_FILTERS);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [expandedRuleCodes, setExpandedRuleCodes] = useState<readonly RuleCode[]>(EMPTY_RULE_CODES);

  const query = useQuery({
    queryKey: [...queryKeys.violation.byProject(projectId), versionId],
    enabled: graph !== null && capabilities.canEdit,
    // `runRules` chạy đồng bộ, nhưng `queryFn` phải trả `Promise` để lượt "đang
    // chạy" của trạng thái 2 là một lượt thật chứ không chỉ có trong story.
    queryFn: async (): Promise<RuleReportRun> => {
      if (graph === null) {
        throw new Error(RUN_FAILED_MESSAGE);
      }

      return runReport(graph, registry);
    },
    // Khoảng chờ giữa hai lần thử lại, lấy từ thang chuyển động (R-71).
    retryDelay: MOTION_DURATIONS_MS.standard,
  });

  const run = query.data ?? null;
  const levelNames = useMemo(() => levelNamesOf(graph), [graph]);
  const built = useMemo(
    () => buildRows(run?.violations ?? EMPTY_VIOLATIONS, levelNames),
    [levelNames, run],
  );

  /* Hàng đã xử lý — trạng thái CỦA PHIÊN XEM, không phải trạng thái nghiệp vụ.
   *
   * Repo không có cơ chế nào đánh dấu một vi phạm là "đã xử lý" (xem
   * `ruleReportGateway.ts`, `canDismiss`), nên nguồn trung thực duy nhất là so
   * hai lượt chạy LIÊN TIẾP của CÙNG một dự án: một hàng có mặt ở lượt trước và
   * biến mất ở lượt này nghĩa là người dùng vừa sửa xong nó. Bộ lọc không đụng
   * tới phép so này — hàng biến mất do lọc thì không phải do được sửa, nên phép
   * so chạy trên danh sách chưa lọc.
   *
   * Trạng thái này SỐNG THEO PHIÊN: rời màn là mất, không có gì được lưu lại. */
  const previousRunRef = useRef<{
    readonly projectId: string;
    readonly rows: readonly RuleReportRow[];
  } | null>(null);

  const resolvedRows = useMemo<readonly RuleReportRow[]>(() => {
    const previous = previousRunRef.current;

    if (run === null || previous === null || previous.projectId !== projectId) {
      return EMPTY_ROWS;
    }

    const currentKeys = new Set(built.rows.map((row) => row.key));

    return previous.rows
      .filter((row) => !currentKeys.has(row.key))
      .map((row) => ({ ...row, resolved: true }));
  }, [built, projectId, run]);

  useEffect(() => {
    if (run !== null) {
      previousRunRef.current = { projectId, rows: built.rows };
    }
  }, [built, projectId, run]);

  /* Bốn con số trần. Đếm bằng `countBySeverity` của domain, không đếm tay; "đạt"
   * suy ra từ số luật đã chạy trừ đi số luật có ít nhất một lỗi. Gộp `suggestion`
   * vào ô "cảnh báo" là chiều an toàn đã chốt: một gợi ý không bao giờ bị đếm
   * vào ô "vi phạm", còn mức thật của từng hàng vẫn hiện nguyên ở chip. */
  const summary = useMemo<RuleReportSummary>(() => {
    if (run === null) {
      return EMPTY_SUMMARY;
    }

    const counts = countBySeverity(run.violations);
    const failedRuleCodes = new Set(run.violations.map((violation) => violation.ruleCode));

    return {
      evaluated: run.ranRuleCodes.length,
      passed: run.ranRuleCodes.length - failedRuleCodes.size,
      warnings: counts.warning + counts.suggestion,
      violations: counts.critical,
    };
  }, [run]);

  /* Lọc theo tầng đi qua phép gộp của domain, không tự lọc bằng tay. */
  const rowsOfLevel = useMemo<readonly RuleReportRow[]>(() => {
    if (run === null) {
      return EMPTY_ROWS;
    }

    if (filters.levelId === 'all') {
      return built.rows;
    }

    const levelGroup = groupViolationsByLevel(run.violations).find(
      (group) => group.levelId === filters.levelId,
    );

    if (levelGroup === undefined) {
      return EMPTY_ROWS;
    }

    return levelGroup.violations
      .map((violation) => built.rowByViolation.get(violation))
      .filter((row): row is RuleReportRow => row !== undefined);
  }, [built, filters.levelId, run]);

  const visibleRows = useMemo<readonly RuleReportRow[]>(() => {
    if (filters.level === 'passed') {
      // Ô "Đạt" nói về LUẬT không ra lỗi, nên nó không có hàng vi phạm nào.
      return EMPTY_ROWS;
    }

    return rowsOfLevel.filter((row) => {
      if (filters.level === 'violation' && row.severity !== 'critical') {
        return false;
      }

      if (filters.level === 'warning' && row.severity === 'critical') {
        return false;
      }

      return filters.group === 'all' || registry.get(row.ruleCode)?.group === filters.group;
    });
  }, [filters.group, filters.level, registry, rowsOfLevel]);

  /* Hàng đã xử lý luôn ở lại trong nhóm của nó, kể cả khi bộ lọc đang thu hẹp:
   * đó là dấu vết tiến độ của người dùng, và spec đòi nó còn nhìn thấy được
   * trong nhóm gấp. */
  const groups = useMemo<readonly RuleReportGroup[]>(() => {
    if (run === null) {
      return EMPTY_GROUPS;
    }

    return groupRowsByRule([...visibleRows, ...resolvedRows], registry);
  }, [registry, resolvedRows, run, visibleRows]);

  const passedRules = useMemo<readonly PassedRule[]>(() => {
    if (run === null) {
      return EMPTY_PASSED;
    }

    const failed = new Set(run.violations.map((violation) => violation.ruleCode));
    const passed: PassedRule[] = [];

    for (const ruleCode of run.ranRuleCodes) {
      const rule = registry.get(ruleCode);

      if (rule === null || failed.has(ruleCode)) {
        continue;
      }

      if (filters.group === 'all' || rule.group === filters.group) {
        passed.push({ ruleCode, ruleName: rule.name, group: rule.group });
      }
    }

    return passed;
  }, [filters.group, registry, run]);

  const skipped = useMemo<readonly SkippedRuleGroup[]>(() => {
    if (run === null || graph === null) {
      return EMPTY_SKIPPED;
    }

    // `graph.byKind.level` là `EntityId[]`; `levelNames` đã lọc sẵn ra đúng
    // những mã tầng đọc được từ đồ thị, nên khoá của nó là danh sách tầng thật.
    return skippedGroupsOf(registry, run.ranRuleCodes, [...levelNames.keys()], projectId);
  }, [graph, levelNames, projectId, registry, run]);

  const status = useMemo<RuleReportStatus>(() => {
    if (!capabilities.canEdit) {
      return 'forbidden';
    }

    if (query.isError) {
      return 'error';
    }

    if (spatialLoading || (graph !== null && run === null)) {
      return 'loading';
    }

    if (graph === null || run === null) {
      return 'empty';
    }

    if (skipped.length > 0) {
      return 'partial';
    }

    return summary.violations > 0 ? 'ready' : 'done';
  }, [capabilities.canEdit, graph, query.isError, run, skipped, spatialLoading, summary]);

  const lastRunLabel = useMemo<string | null>(
    () => (run === null ? null : formatTimestamp(run.ranAtEpochMs, Date.now())),
    [run],
  );

  const onFilterChange = useCallback((next: RuleReportFilters): void => {
    setFilters(next);
  }, []);

  const onToggleGroup = useCallback((ruleCode: RuleCode): void => {
    setExpandedRuleCodes((current) =>
      current.includes(ruleCode) ? current.filter((code) => code !== ruleCode) : [...current, ruleCode],
    );
  }, []);

  const onSelectRow = useCallback((rowKey: string): void => {
    setSelectedRowKey(rowKey);
  }, []);

  /**
   * "Xem" — chọn hàng rồi mở màn 3D của dự án.
   *
   * Đường dẫn lấy từ hằng `@/routes/paths`, không viết chuỗi (R-65), và màn này
   * KHÔNG nhập gì từ `src/screens/viewer/**`: khuôn camera tới đúng đối tượng là
   * việc của `ViewerSceneHandle`, thuộc màn kia.
   */
  const onViewRow = useCallback(
    (rowKey: string): void => {
      setSelectedRowKey(rowKey);
      navigate(ROUTES.project.viewer(projectId));
    },
    [navigate, projectId],
  );

  const onRerun = useCallback((): void => {
    void query.refetch();
  }, [query]);

  /**
   * "Xác nhận đã xử lý" — đưa người dùng sang bước xuất bản.
   *
   * Nút này KHÔNG lưu một trạng thái duyệt nào: store và domain không có trường
   * nào ghi nhận "đã duyệt QC" (không `reviewedAt`, không người duyệt, không cờ
   * phê duyệt). Nó chỉ đi tiếp sang bước kế tiếp. Vì vậy mọi nhãn ở tầng view
   * chỉ được nói về KẾT QUẢ LƯỢT CHẠY ("không phát hiện vi phạm nào") và tuyệt
   * đối không được trình bày như dấu xác nhận của người duyệt — bất biến A5 giữ
   * màu xanh "đã xác minh" cho riêng việc của NGƯỜI duyệt, đầu ra của máy không
   * bao giờ được đặt nó.
   */
  const onConfirmResolved = useCallback((): void => {
    if (summary.violations > 0) {
      return;
    }

    navigate(ROUTES.project.export(projectId));
  }, [navigate, projectId, summary.violations]);

  /**
   * Chỗ gắn canvas của panel xem trước.
   *
   * `capabilities.canPreview3d === false` nên view không render panel, và hàm
   * này không lắp cảnh nào. Nó vẫn ở đây để chữ ký của props không đổi khi hai
   * mảnh còn thiếu — bộ đổi `NormalizedSpatial -> PresentationPlan` và một API
   * camera nhận `entityId` — được bổ sung ở `@/lib/three/present`.
   */
  const previewRef = useCallback((canvas: HTMLCanvasElement | null): void => {
    void canvas;
  }, []);

  return {
    status,
    summary,
    groups,
    resolvedRows,
    passedRules,
    skipped,
    filters,
    capabilities,
    progress: null,
    lastRunLabel,
    selectedRowKey,
    expandedRuleCodes,
    isFiltered:
      filters.level !== DEFAULT_FILTERS.level ||
      filters.group !== DEFAULT_FILTERS.group ||
      filters.levelId !== DEFAULT_FILTERS.levelId,
    isCompact,
    errorMessage: query.isError ? RUN_FAILED_MESSAGE : null,
    onFilterChange,
    onToggleGroup,
    onSelectRow,
    onViewRow,
    onRerun,
    onConfirmResolved,
    previewRef,
  };
}
