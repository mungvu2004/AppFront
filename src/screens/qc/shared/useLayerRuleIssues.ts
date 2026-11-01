/**
 * Lỗi quy chuẩn của MỘT lớp trên MỘT tầng, ngay trong Duyệt tầng (P03).
 *
 * Cùng sổ luật và cùng cấu hình dự án với màn Quy chuẩn (`useRuleReport`), nên số lỗi
 * ở đây khớp số ở đó. Lỗi thuộc lớp nào lấy từ `fixLayerOf` — đúng lớp nút "Sửa" mở —
 * nên "phòng thiếu cửa sổ" hiện ở lớp Cửa và nội thất, "phòng hở" ở lớp Tường.
 *
 * Mở từ nút "Sửa" thì URL mang `?rule=&issue=&tool=` (`fixTargetOf`): lỗi đó được chỉ
 * sẵn (`focused`) và công cụ bật sẵn (`initialTool`, đọc một lần lúc mở).
 */

import { useQuery } from '@tanstack/react-query';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';

import { EMPTY_RULE_CONFIG, withSeparateUnits } from '@/domain/rules/config';
import type { RuleSeverity, Violation } from '@/domain/rules/registry';
import { runRules } from '@/domain/rules/runner';
import { isEntityOfKind, type NormalizedSpatial } from '@/domain/spatial/normalize';
import type { Point } from '@/domain/spatial/types';
import { useSeparateUnitsFlag } from '@/hooks/useSeparateUnitsFlag';
import type { FloorLayerKey } from '@/routes/projectSteps';
import { useStore } from '@/store';
import { ruleRegistryFor } from '@/store/selectors';

import { createRuleSettingsGateway, ruleSettingsQueryKey } from '../../rules/RuleSettings/ruleSettingsGateway';
import { FIX_QUERY, fixLayerOf, fixToolOf, type FixTool } from '../../rules/ViolationDetail/fixPath';

export interface LayerRuleIssue {
  /** `ruleCode|entityId` — một luật báo một đối tượng một lần trên một tầng. */
  readonly key: string;
  readonly ruleCode: string;
  readonly ruleName: string;
  readonly severity: RuleSeverity;
  readonly entityId: string;
  readonly message: string;
  readonly suggestion: string;
  /** Chỗ để đánh dấu và phóng tới, mm trên bản vẽ: điểm lỗi nếu luật có, không thì tâm đối tượng. */
  readonly at: Point | null;
  readonly tool: FixTool | null;
}

export interface LayerRuleIssues {
  readonly issues: readonly LayerRuleIssue[];
  /** Lỗi đang được chỉ (mở từ "Sửa" hoặc bấm trong danh sách); `null` khi không chỉ lỗi nào. */
  readonly focused: LayerRuleIssue | null;
  /** Lỗi vừa chỉ đã hết sau lần sửa — để nói "Đã xử lý" thay vì im lặng biến mất. */
  readonly focusResolved: boolean;
  /** Công cụ nút "Sửa" xin bật (`?tool=`), đọc một lần lúc mở lớp. */
  readonly initialTool: FixTool | null;
  readonly onFocus: (key: string) => void;
  readonly onClearFocus: () => void;
}

interface Options {
  readonly projectId: string;
  readonly levelId: string | null;
  readonly layer: FloorLayerKey;
}

const EMPTY: readonly LayerRuleIssue[] = Object.freeze([]);
const keyOf = (ruleCode: string, entityId: string) => `${ruleCode}|${entityId}`;

const mean = (points: readonly Point[]): Point | null =>
  points.length === 0
    ? null
    : {
        x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
        y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
      };

/** Tâm của đối tượng lỗi khi luật không chỉ một điểm. */
export function entityCentreOf(graph: NormalizedSpatial, entityId: string): Point | null {
  const entity = graph.byId[entityId];
  if (entity === undefined) return null;
  if (isEntityOfKind('wall', entity)) return mean([entity.centreline.start, entity.centreline.end]);
  if (isEntityOfKind('room', entity)) return mean(entity.outline);
  if (isEntityOfKind('furniture', entity)) return entity.centre;
  if (isEntityOfKind('opening', entity)) {
    const wall = graph.byId[entity.wallId];
    if (wall === undefined || !isEntityOfKind('wall', wall)) return null;
    const { start, end } = wall.centreline;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const t = length === 0 ? 0 : (entity.offsetMm + entity.widthMm / 2) / length;
    return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
  }
  return null;
}

function readFixQuery(): { focusKey: string | null; tool: FixTool | null } {
  const params = new URLSearchParams(window.location.search);
  const rule = params.get(FIX_QUERY.rule);
  const issue = params.get(FIX_QUERY.issue);
  const tool = params.get(FIX_QUERY.tool);
  return {
    focusKey: rule === null || issue === null ? null : keyOf(rule, issue),
    tool: tool === 'door' || tool === 'window' || tool === 'wall' ? tool : null,
  };
}

/** Bỏ `?rule=&issue=&tool=` khỏi URL khi thôi chỉ lỗi; không thêm mục lịch sử. */
function dropFixQuery(): void {
  const url = new URL(window.location.href);
  for (const name of Object.values(FIX_QUERY)) url.searchParams.delete(name);
  window.history.replaceState(window.history.state, '', url);
}

export function useLayerRuleIssues({ projectId, levelId, layer }: Options): LayerRuleIssues {
  const configQuery = useQuery({
    queryKey: ruleSettingsQueryKey(projectId),
    queryFn: ({ signal }) => createRuleSettingsGateway().read({ projectId, signal }),
  });
  const separateUnits = useSeparateUnitsFlag(projectId);
  const config = configQuery.data?.config;
  const ruleConfig = useMemo(
    () => withSeparateUnits(config ?? EMPTY_RULE_CONFIG, separateUnits),
    [config, separateUnits],
  );
  const registry = useMemo(() => ruleRegistryFor(ruleConfig), [ruleConfig]);
  /* Chạy luật ngoài nhịp kéo/vẽ: bản vẽ không chờ cả sổ luật mỗi lần đồ thị đổi. */
  const graph = useDeferredValue(useStore((state) => state.spatial));

  const issues = useMemo<readonly LayerRuleIssue[]>(() => {
    if (graph === null || levelId === null || config === undefined) return EMPTY;
    const seen = new Set<string>();
    const out: LayerRuleIssue[] = [];
    for (const violation of runRules(graph, { registry, config: ruleConfig }).violations as readonly Violation[]) {
      if (violation.levelId !== levelId || fixLayerOf(violation.entityId, violation.ruleCode) !== layer) continue;
      const key = keyOf(violation.ruleCode, violation.entityId);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        key,
        ruleCode: violation.ruleCode,
        ruleName: registry.get(violation.ruleCode)?.name ?? violation.ruleCode,
        severity: violation.severity,
        entityId: violation.entityId,
        message: violation.message,
        suggestion: violation.suggestion,
        at: violation.at ?? entityCentreOf(graph, violation.entityId),
        tool: fixToolOf(violation.ruleCode),
      });
    }
    return out;
  }, [config, graph, layer, levelId, registry, ruleConfig]);

  const [fromUrl] = useState(readFixQuery);
  const [focusKey, setFocusKey] = useState<string | null>(fromUrl.focusKey);
  const focused = focusKey === null ? null : (issues.find((issue) => issue.key === focusKey) ?? null);
  /* Chưa chạy xong luật (cấu hình đang tải) thì chưa nói "đã xử lý". */
  const focusResolved = focusKey !== null && focused === null && config !== undefined && graph !== null;

  const onFocus = useCallback((key: string) => setFocusKey(key), []);
  const onClearFocus = useCallback(() => {
    setFocusKey(null);
    dropFixQuery();
  }, []);

  return { issues, focused, focusResolved, initialTool: fromUrl.tool, onFocus, onClearFocus };
}
