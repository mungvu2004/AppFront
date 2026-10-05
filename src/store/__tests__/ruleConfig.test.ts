/**
 * Bằng chứng của D-03: đổi cấu hình bộ luật làm BÁO CÁO ĐỔI THEO.
 *
 * Bài kiểm quan trọng nhất trong file này là bài đầu tiên. Trước lượt sửa này,
 * `ensureViolations` thoát sớm khi `graph === spatial`; đổi cấu hình luật không
 * đụng vào `spatial`, nên điều kiện ấy vẫn đúng và mảng vi phạm CŨ được trả lại
 * nguyên vẹn. Tắt một luật rồi in số vi phạm ra hai lần cho hai con số bằng
 * nhau, và không có lỗi nào để đọc. Bài kiểm dưới đây in ra hai con số ấy và
 * đòi chúng khác nhau.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as runner from '../../domain/rules/runner';
import { GENERAL_THRESHOLD_CODE, type RuleConfig } from '../../domain/rules/config';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import { createSampleBuilding } from '../../domain/spatial/__fixtures__/sampleBuilding';
import { useStore } from '../index';

/*
 * `runRules` thật, chỉ bọc để đọc tham số: bộ mẫu A14 không đổi số vi phạm theo
 * khoá `GENERAL` nào (đo ở F-10 — xem bài "ngưỡng chung" bên dưới), nên bằng
 * chứng K22 là cấu hình THẬT SỰ tới tay `runRules`.
 */
vi.mock('../../domain/rules/runner', async (importOriginal) => {
  const actual = await importOriginal<typeof runner>();

  return { ...actual, runRules: vi.fn(actual.runRules) };
});
import { INITIAL_RULE_CONFIG } from '../ruleConfigSlice';
import {
  resetSelectorCaches,
  ruleRegistryFor,
  selectRuleConfig,
  selectRuleImpactCounts,
  selectTotalViolationCount,
  selectViolations,
} from '../selectors';

/**
 * Luật nổ nhiều nhất trên bộ mẫu chuẩn của A14, và số vi phạm nó đóng góp.
 *
 * Chọn một luật CÓ vi phạm là chủ ý: tắt một luật vốn im lặng thì tổng không
 * đổi, và bài kiểm sẽ xanh kể cả khi khoá cache vẫn hỏng.
 */
const NOISY_RULE = 'WALL-DANGLING-END';
const NOISY_RULE_VIOLATIONS = 96;
/** Tổng vi phạm của bộ mẫu chuẩn khi chưa ai chỉnh luật (A14). */
const TOTAL_WITH_DEFAULT_RULES = 182;

const configWith = (overrides: RuleConfig['overrides']): RuleConfig => ({
  overrides,
  version: 0,
});

const loadSampleBuilding = (): void => {
  useStore.setState({
    ruleConfig: INITIAL_RULE_CONFIG,
    spatial: normalizeSpatial(createSampleBuilding()),
  });
};

describe('store/ruleConfig — cấu hình bộ luật là dữ liệu', () => {
  beforeEach(() => {
    resetSelectorCaches();
    loadSampleBuilding();
  });

  describe('D-03: cấu hình đổi thì báo cáo chạy lại', () => {
    it('tắt một luật làm số vi phạm ĐỔI, trong khi mô hình không gian đứng yên', () => {
      const before = selectTotalViolationCount(useStore.getState());
      const spatialBefore = useStore.getState().spatial;

      expect(before).toBe(TOTAL_WITH_DEFAULT_RULES);

      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: false } }),
          `tắt luật ${NOISY_RULE}`,
        );

      const after = selectTotalViolationCount(useStore.getState());

      // Đây là hai con số của nghiệm thu. Bằng nhau nghĩa là khoá cache hỏng.
      expect(after).not.toBe(before);
      expect(after).toBe(TOTAL_WITH_DEFAULT_RULES - NOISY_RULE_VIOLATIONS);
      // Không lượt ghi nào chạm vào dữ liệu không gian: cùng một tham chiếu.
      expect(useStore.getState().spatial).toBe(spatialBefore);
    });

    it('bật lại luật vừa tắt trả số vi phạm về đúng chỗ cũ', () => {
      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: false } }),
          `tắt luật ${NOISY_RULE}`,
        );
      expect(selectTotalViolationCount(useStore.getState())).toBe(
        TOTAL_WITH_DEFAULT_RULES - NOISY_RULE_VIOLATIONS,
      );

      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: true } }),
          `bật lại luật ${NOISY_RULE}`,
        );

      expect(selectTotalViolationCount(useStore.getState())).toBe(TOTAL_WITH_DEFAULT_RULES);
    });

    it('đổi mức nghiêm trọng đổi mức của chính những vi phạm ấy', () => {
      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { severity: 'suggestion' } }),
          `hạ mức luật ${NOISY_RULE} xuống gợi ý`,
        );

      const ofRule = selectViolations(useStore.getState()).filter(
        (violation) => violation.ruleCode === NOISY_RULE,
      );

      expect(ofRule).toHaveLength(NOISY_RULE_VIOLATIONS);
      expect(ofRule.every((violation) => violation.severity === 'suggestion')).toBe(true);
    });

    it('luật KHÔNG bị đè giữ nguyên trạng thái mặc định của nó', () => {
      // ROOM-HAS-DOOR và ROOM-MIN-AREA đã bị nhóm function thay thế và đang tắt.
      // Một cấu hình chỉ nói về một luật khác không được đánh thức chúng dậy.
      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: false } }),
          `tắt luật ${NOISY_RULE}`,
        );

      const codes = new Set(
        selectViolations(useStore.getState()).map((violation) => violation.ruleCode),
      );

      expect(codes.has('ROOM-HAS-DOOR')).toBe(false);
      expect(codes.has('ROOM-MIN-AREA')).toBe(false);
    });

    it('cấu hình không đổi vẫn dùng lại đúng mảng cũ', () => {
      const first = selectViolations(useStore.getState());

      expect(selectViolations(useStore.getState())).toBe(first);
    });
  });

  describe('commitRuleConfig — một cửa, có nhãn, hoàn tác được', () => {
    it('tăng version mỗi lượt ghi, vì version là khoá cache của Đ4', () => {
      expect(selectRuleConfig(useStore.getState()).version).toBe(0);

      useStore.getState().commitRuleConfig(configWith({}), 'khôi phục mặc định');
      expect(selectRuleConfig(useStore.getState()).version).toBe(1);

      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: false } }),
          `tắt luật ${NOISY_RULE}`,
        );
      expect(selectRuleConfig(useStore.getState()).version).toBe(2);
    });

    it('ghi nhãn tiếng Việt vào lịch sử, đúng chỗ chỉ báo tự lưu đang đọc (A7)', () => {
      const label = `tắt luật ${NOISY_RULE}`;
      const result = useStore
        .getState()
        .commitRuleConfig(configWith({ [NOISY_RULE]: { enabled: false } }), label);

      expect(result.label).toBe(label);
      expect(useStore.getState().lastCommitLabel).toBe(label);
      expect(useStore.getState().lastCommitTimestamp).toBe(result.timestamp);
    });

    it('undo() trả cấu hình VÀ số vi phạm về trước lượt ghi (A8)', () => {
      const before = selectTotalViolationCount(useStore.getState());

      const result = useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: false } }),
          `tắt luật ${NOISY_RULE}`,
        );

      expect(selectTotalViolationCount(useStore.getState())).not.toBe(before);

      result.undo();

      expect(selectRuleConfig(useStore.getState()).overrides).toEqual(
        INITIAL_RULE_CONFIG.overrides,
      );
      expect(selectTotalViolationCount(useStore.getState())).toBe(before);
    });

    it('nhãn lượt lùi dùng tiền tố chung "Hoàn tác: ", lùi lần hai thì bỏ tiền tố, không nhân đôi (B-V12-41)', () => {
      const label = `Tắt luật ${NOISY_RULE}`;

      useStore.getState().commitRuleConfig(configWith({ [NOISY_RULE]: { enabled: false } }), label).undo();
      expect(useStore.getState().lastCommitLabel).toBe(`Hoàn tác: ${label}`);

      useStore.getState().lastCommitUndo?.();
      expect(useStore.getState().lastCommitLabel).toBe(label);
    });
  });

  describe('selectRuleImpactCounts', () => {
    it('mang đủ mọi mã luật, luật im lặng thì mang số 0', () => {
      const counts = selectRuleImpactCounts(useStore.getState());

      expect(Object.keys(counts)).toHaveLength(25);
      expect(counts[NOISY_RULE]).toBe(NOISY_RULE_VIOLATIONS);
      expect(counts['WALL-THICKNESS']).toBe(0);
    });

    it('tổng các số ảnh hưởng bằng đúng tổng vi phạm', () => {
      const counts = selectRuleImpactCounts(useStore.getState());
      const summed = Object.values(counts).reduce((total, count) => total + count, 0);

      expect(summed).toBe(selectTotalViolationCount(useStore.getState()));
    });

    it('trả về cùng một object khi chưa có gì đổi', () => {
      const first = selectRuleImpactCounts(useStore.getState());

      expect(selectRuleImpactCounts(useStore.getState())).toBe(first);
    });

    it('theo kịp một luật vừa bị tắt', () => {
      useStore
        .getState()
        .commitRuleConfig(
          configWith({ [NOISY_RULE]: { enabled: false } }),
          `tắt luật ${NOISY_RULE}`,
        );

      expect(selectRuleImpactCounts(useStore.getState())[NOISY_RULE]).toBe(0);
    });
  });

  describe('không có mô hình', () => {
    it('trả về 0 và một bộ đếm rỗng thay vì ngã', () => {
      useStore.setState({ ruleConfig: INITIAL_RULE_CONFIG, spatial: null });

      expect(selectTotalViolationCount(useStore.getState())).toBe(0);
      expect(
        Object.values(selectRuleImpactCounts(useStore.getState())).every((count) => count === 0),
      ).toBe(true);
    });
  });
});

describe('F-10: ngưỡng chung (GENERAL) có tác dụng — K22', () => {
  beforeEach(() => {
    resetSelectorCaches();
    loadSampleBuilding();
  });

  /*
   * Lệch khỏi prompt [8].4: cả hai khoá `GENERAL` (`general.jointToleranceMm`,
   * `general.parallelAngleDeg`) đều không đổi số vi phạm của bộ mẫu ở biên 0 và
   * biên trên (đo: 182 cả bốn lượt) — 96 đầu tường hở của bộ mẫu cách nhau hơn
   * 500 mm. Nên bài này khẳng định `ensureViolations` đưa `config` xuống
   * `runRules`; nó đỏ trên mã trước sửa (`{ registry }` không có `config`).
   */
  it('lượt chạy luật nhận cấu hình, kèm ngưỡng chung, chứ không chỉ sổ luật', () => {
    const config = configWith({
      [GENERAL_THRESHOLD_CODE]: { thresholds: { 'general.jointToleranceMm': 500 } },
    });
    vi.mocked(runner.runRules).mockClear();

    useStore.getState().commitRuleConfig(config, 'Đổi ngưỡng khoảng hở tối đa');
    selectTotalViolationCount(useStore.getState());

    const options = vi.mocked(runner.runRules).mock.calls.at(-1)?.[1];
    expect(options?.config?.overrides[GENERAL_THRESHOLD_CODE]).toEqual({
      thresholds: { 'general.jointToleranceMm': 500 },
    });
  });

  it('luật có override riêng vẫn đọc ngưỡng mà lượt chạy giải sẵn (chung + riêng)', () => {
    const graph = normalizeSpatial(createSampleBuilding());
    const rule = ruleRegistryFor(configWith({ 'WALL-THICKNESS': { severity: 'suggestion' } })).get('WALL-THICKNESS');

    // Trần 10 m: mọi tường của bộ mẫu đều "mỏng hơn tối thiểu". Bọc cũ ghi đè ngưỡng của
    // ngữ cảnh bằng `{}` (ngưỡng riêng rỗng) nên luật rơi về hằng số và im lặng.
    const findings = rule?.check({ graph, levelId: null, thresholds: { 'wall.minThicknessMm': 10_000 } }) ?? [];

    expect(findings.length).toBeGreaterThan(0);
  });
});

describe('F-10: hydrateRuleConfig và setRuleConfigRevision', () => {
  beforeEach(() => {
    useStore.setState({
      lastCommitLabel: null,
      lastCommitUndo: null,
      ruleConfig: INITIAL_RULE_CONFIG,
      ruleConfigProjectId: null,
      ruleConfigRevision: 0,
    });
  });

  it('nạp không đặt nhãn lịch sử, không dựng undo, và version tăng', () => {
    const versionBefore = useStore.getState().ruleConfig.version;

    useStore.getState().hydrateRuleConfig({
      projectId: 'P-1',
      revision: 7,
      overrides: { 'WALL-THICKNESS': { enabled: false } },
    });

    const state = useStore.getState();
    expect(state.lastCommitLabel).toBeNull();
    expect(state.lastCommitUndo).toBeNull();
    expect(state.ruleConfig.version).toBe(versionBefore + 1);
    expect(state.ruleConfig.overrides).toEqual({ 'WALL-THICKNESS': { enabled: false } });
    expect(state.ruleConfigProjectId).toBe('P-1');
    expect(state.ruleConfigRevision).toBe(7);
  });

  it('setRuleConfigRevision bỏ qua dự án khác', () => {
    useStore.getState().hydrateRuleConfig({ projectId: 'P-1', revision: 2, overrides: {} });

    useStore.getState().setRuleConfigRevision('P-2', 9);
    expect(useStore.getState().ruleConfigRevision).toBe(2);

    useStore.getState().setRuleConfigRevision('P-1', 3);
    expect(useStore.getState().ruleConfigRevision).toBe(3);
  });

  it('commitRuleConfig vẫn đặt lastCommit', () => {
    useStore.getState().commitRuleConfig(configWith({ 'WALL-THICKNESS': { enabled: false } }), 'Tắt luật');

    expect(useStore.getState().lastCommitLabel).toBe('Tắt luật');
    expect(useStore.getState().lastCommitUndo).not.toBeNull();
  });
});
