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

import { describe, it, expect, beforeEach } from 'vitest';
import type { RuleConfig } from '../../domain/rules/config';
import { normalizeSpatial } from '../../domain/spatial/normalize';
import { createSampleBuilding } from '../../domain/spatial/__fixtures__/sampleBuilding';
import { useStore } from '../index';
import { INITIAL_RULE_CONFIG } from '../ruleConfigSlice';
import {
  resetSelectorCaches,
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
