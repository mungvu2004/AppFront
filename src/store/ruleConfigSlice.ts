/**
 * Cấu hình bộ luật của dự án, giữ trong store như DỮ LIỆU.
 *
 * Quyết định Đ3 của hợp đồng: bật/tắt một luật **không** gọi
 * `registry.setEnabled()`. Sổ đăng ký là một singleton toàn tiến trình — ghi vào
 * nó thì không hoàn tác được, không tự lưu được, và hai màn đang mở cùng lúc sẽ
 * nhìn thấy hai sự thật khác nhau mà không ai báo. Cấu hình vì thế là một object
 * bất biến nằm trong store, và mọi lượt ghi đi qua đúng một cửa —
 * {@link RuleConfigSlice.commitRuleConfig} — y như `commit(patch, label)` là cửa
 * duy nhất của dữ liệu không gian (A10).
 *
 * Nhờ đi qua một cửa duy nhất, hai bất biến có chỗ giữ chứ không phải lời hứa:
 *
 * - **A8 — mọi thay đổi hoàn tác được.** Cửa trả về một `undo()` đóng gói sẵn
 *   cấu hình TRƯỚC lượt ghi, để tầng hook dựng vé hoàn tác 8 giây
 *   (`lib/mutations/undoTicket.ts`) mà không phải tự nhớ giá trị cũ.
 * - **A7 — không có nút lưu.** Cửa ghi nhãn vào `historySlice`, đúng chỗ chỉ báo
 *   tự lưu và toast đang đọc, nên một lượt đổi ngưỡng nói ra được trạng thái của
 *   nó y hệt một lượt sửa tường.
 *
 * Ctrl+Z **không** hoàn tác cấu hình luật, và đó là chủ ý: `temporal` của zundo
 * chỉ theo dõi `spatial` (`store/index.ts`, `partialize`). Đổi một ngưỡng rồi
 * nhấn Ctrl+Z phải trả lại bức tường vừa kéo, chứ không phải âm thầm bật lại một
 * luật mà người dùng vừa tắt ở màn khác. Đường hoàn tác của cấu hình là vé toast
 * mà `commitRuleConfig` trả về.
 *
 * `version` là khoá cache của quyết định Đ4: `store/selectors.ts` chỉ dùng lại
 * mảng vi phạm cũ khi CẢ mô hình không gian LẪN version đều chưa đổi. Một lượt
 * ghi quên tăng `version` là một vi phạm câm — không lỗi biên dịch, chỉ là màn
 * hình in ra con số cũ — nên cửa này tự tăng thay vì tin vào người gọi.
 */

import type { StateCreator } from 'zustand';
import type { RuleConfig, RuleOverride } from '../domain/rules/config';
import type { RuleCode } from '../domain/rules/registry';
import { toggleUndoDescription } from '../lib/commands/invert';
import type { HistorySlice } from './historySlice';

/**
 * Cấu hình của một dự án chưa ai chạm vào: không luật nào bị đè, version 0.
 *
 * Trùng ý với `EMPTY_RULE_CONFIG` của `domain/rules/config.ts` — hằng số ấy là
 * bản chính. Ở đây khai lại một giá trị khởi tạo vì store phải có trạng thái ban
 * đầu ngay cả khi module domain chưa nạp, và vì `{ overrides: {}, version: 0 }`
 * là thứ duy nhất "chưa ai chạm vào" có thể là.
 */
export const INITIAL_RULE_CONFIG: RuleConfig = Object.freeze({
  overrides: Object.freeze({}),
  version: 0,
});

/** Kết quả một lượt ghi cấu hình: cùng hình dạng với `CommitResult` của `commit`. */
export interface RuleConfigCommit {
  /** Trả cấu hình về đúng như trước lượt ghi này. */
  undo: () => void;
  /** Nhãn tiếng Việt đã ghi vào lịch sử. */
  label: string;
  timestamp: number;
}

export interface RuleConfigSlice {
  /** Cấu hình bộ luật đang áp cho dự án. */
  ruleConfig: RuleConfig;
  /**
   * Cửa duy nhất để đổi cấu hình bộ luật.
   *
   * @param next Cấu hình MỚI trọn vẹn, do `domain/rules/config.ts` dựng ra.
   *   `version` của nó bị bỏ qua: cửa này tự đặt version kế tiếp.
   * @param label Câu tiếng Việt viết thường, kiểu câu (A6) — ví dụ
   *   `'tắt luật CORRIDOR-WIDTH'`.
   */
  commitRuleConfig: (next: RuleConfig, label: string) => RuleConfigCommit;
  /** Dự án mà `ruleConfig` đang thuộc về; `null` khi chưa nạp lần nào (N21). */
  ruleConfigProjectId: string | null;
  /** `revision` của máy chủ ứng với `ruleConfig` — `baseVersion` của lượt N22 kế tiếp. */
  ruleConfigRevision: number;
  /**
   * Nạp bản đã lưu (N21) — KHÔNG phải một thay đổi của người dùng: không nhãn
   * lịch sử, không `undo`, nên host toast không mời "hoàn tác" một lượt nạp.
   * `version` vẫn tiến lên để cache vi phạm (Đ4) biết cấu hình đã đổi.
   */
  hydrateRuleConfig: (input: {
    projectId: string;
    revision: number;
    overrides: Readonly<Record<RuleCode, RuleOverride>>;
  }) => void;
  /** Ghi `revision` vừa lưu (N22). Bỏ qua khi `projectId` không còn là dự án đang nạp. */
  setRuleConfigRevision: (projectId: string, revision: number) => void;
}

/** Cấu hình y hệt, chỉ khác số version. */
const atVersion = (config: RuleConfig, version: number): RuleConfig => ({
  ...config,
  version,
});

export const createRuleConfigSlice: StateCreator<
  RuleConfigSlice & HistorySlice,
  [],
  [],
  RuleConfigSlice
> = (set, get) => ({
  ruleConfig: INITIAL_RULE_CONFIG,
  ruleConfigProjectId: null,
  ruleConfigRevision: 0,
  hydrateRuleConfig: ({ projectId, revision, overrides }) => {
    set({
      ruleConfig: { overrides, version: get().ruleConfig.version + 1 },
      ruleConfigProjectId: projectId,
      ruleConfigRevision: revision,
    });
  },
  setRuleConfigRevision: (projectId, revision) => {
    if (get().ruleConfigProjectId !== projectId) {
      return;
    }

    set({ ruleConfigRevision: revision });
  },
  commitRuleConfig: (next, label) => {
    const previous = get().ruleConfig;
    const timestamp = Date.now();

    // Lượt hoàn tác cũng là một lượt ghi, nên nó đi qua đúng cửa này lần nữa:
    // version vẫn tiến lên, vì cache vi phạm phân biệt hai lần chạy bằng version
    // chứ không bằng nội dung — trả về version cũ sẽ khiến cache tưởng nó đã có
    // sẵn kết quả của lần này. Đi lại qua cửa còn đặt luôn `lastCommitUndo` cho
    // lượt lùi, nên toast của lượt lùi cũng lùi được (A8), thay vì rơi về
    // `temporal.undo()` của zundo — thứ chỉ biết dữ liệu không gian.
    const undo = (): void => {
      // Cùng tiền tố với lệnh không gian, và lùi lượt lùi thì bỏ tiền tố chứ không nhân đôi (B-V12-41).
      get().commitRuleConfig(previous, toggleUndoDescription(label));
    };

    set({ ruleConfig: atVersion(next, previous.version + 1) });

    // Nhãn đi cùng cách lùi nó: host toast toàn cục đọc `lastCommitLabel` và chỉ
    // biết lùi bằng thứ được giao ở đây. Trước đây nó tự gọi `temporal.undo()`
    // của zundo, nên chỉ mở màn cài đặt bộ luật là một toast hiện ra mà nút Hoàn
    // tác của nó lùi lần sửa tường gần nhất — xem `historySlice.lastCommitUndo`.
    get().setLastCommit(label, timestamp, undo);

    return {
      label,
      timestamp,
      undo,
    };
  },
});
