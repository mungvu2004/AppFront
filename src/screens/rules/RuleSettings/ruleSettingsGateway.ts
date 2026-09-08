/**
 * Cổng của màn cài đặt bộ luật: nó được làm gì, và cấu hình nó sửa nằm ở đâu.
 *
 * Chép khuôn `ruleReportGateway.ts` của màn S-31: màn hỏi cổng này xem nó được
 * làm gì, và **năng lực nào `false` thì phần giao diện tương ứng rời khỏi DOM**
 * — không nút bị vô hiệu hoá, không ô trống, không ghi chú "sắp có".
 *
 * ## CHƯA QUA MẠNG: `RuleConfig` sống trong bộ nhớ của module này
 *
 * Repo hôm nay **không có endpoint nào nhận một `RuleConfig`**. `ProjectSchema`
 * (`src/api/schemas/index.ts`) khai `.strict()`, nên thêm một khoá lạ vào lượt
 * gửi làm hỏng luôn bước giải mã của lần đọc lại — bịa một đường dây ở đây thì
 * hỏng to hơn là không có.
 *
 * Nên cấu hình được giữ trong một `Map` của riêng module này, **khoá theo mã dự
 * án**, đúng khuôn bảy trường chưa có dây của
 * `screens/project/ProjectSettings/projectSettingsGateway.ts:141-195`. Hệ quả,
 * nói thẳng chứ không giấu sau chữ "đã lưu":
 *
 * - trong một phiên, người dùng sửa được và màn đọc lại được ngay, nên câu
 *   "Đã lưu lúc 14:32" của A7 **nói thật về thứ nó làm được**;
 * - **tải lại trang là mất**: cấu hình trở về mặc định, vì nó chưa đi đâu cả.
 *
 * Mở đường dây là một lượt riêng ở tầng dữ liệu, mã đề xuất **T-05** (T-04 đã
 * là của màn cài đặt dự án, đừng gộp vào): thêm chỗ chứa `RuleConfig` ở tầng
 * API rồi bỏ `Map` trong file này đi. Khi ấy đây là file duy nhất phải sửa —
 * `useRuleSettings.ts` và view không đổi một dòng nào.
 *
 * ## Hai năng lực THẬT, đến từ quyền của người dùng
 *
 * `canEditRules` và `canApplyPreset` là `true` khi người dùng có quyền
 * `project.settings.edit` (`lib/auth/permissions.ts`), vì **tầng logic có
 * thật**: `@/domain/rules/config` sinh ra một `RuleConfig` bất biến mới cho mỗi
 * lượt sửa, và `@/domain/rules/presets` đo trước hậu quả của một bộ luật sẵn
 * bằng `diffPreset`. Không có mảnh nào phải bịa ở tầng màn hình.
 *
 * Hai năng lực đi cùng nhau chứ không tách: áp một bộ luật sẵn là ghi đè hàng
 * loạt lên đúng những giá trị mà `canEditRules` bảo vệ, nên một người không sửa
 * được từng luật thì càng không được đổi cả 25 luật bằng một cú bấm.
 *
 * ## Hai thứ đặc tả gốc đòi mà màn này CỐ Ý KHÔNG DỰNG
 *
 * Ghi thẳng ở đây, kèm lý do đã kiểm chứng trong mã, để lần sau không ai phải
 * đi khảo sát lại rồi kết luận ngược:
 *
 * 1. **Toggle "cho phép lần chạy AI mới ghi đè mục chưa duyệt".**
 *    Quyết định giữ hay ghi đè phần đã duyệt **đã có chủ**, và nó không phải
 *    một cài đặt: nó là một lựa chọn **của từng lượt chạy lại**, hỏi ngay tại
 *    lớp xác nhận của màn sơ đồ pipeline — `keepApproved` ở
 *    `screens/pipeline/PipelineGraph/pipelineGraphGateway.ts:228`, đi thẳng vào
 *    `rerunMutation` (`usePipelineGraph.ts:284,570`) và nói ra hậu quả đo được
 *    của đúng lượt đó ("sẽ dựng lại N tường đã duyệt", `pipelineGraphText.ts:196`).
 *    Không tồn tại trường nào trong `src/store`, `src/domain` hay `src/api` giữ
 *    lựa chọn ấy lâu dài. Dựng một công tắc bền ở màn này nghĩa là hai nơi cùng
 *    quyết định một việc qua hai nguồn khác nhau, và nơi hỏi *đúng lúc* — ngay
 *    trước khi ghi đè, với con số thật của lượt đó — sẽ là nơi bị công tắc kia
 *    nói đè lên. Đây là quyết định **Đ5** của hợp đồng.
 * 2. **Ô "độ tin cậy tối thiểu để tự duyệt".**
 *    `confidenceThreshold` (mặc định `0,75`) **đã thuộc màn cài đặt dự án** —
 *    `screens/project/ProjectSettings/projectSettingsGateway.ts:65,147`, có ô
 *    nhập ở `UnitsTab.tsx:72`. Dựng lại ở đây là để hai màn sửa **cùng một giá
 *    trị** qua hai đường khác nhau, đúng cái bẫy trùng lặp mà CLAUDE.md đã dọn
 *    một lần rồi.
 *
 * Hệ quả: thẻ "Ngưỡng chung" của màn này chỉ giữ **dung sai hình học của luật**
 * (`RULE_THRESHOLD_SPECS` với `isGeneral === true`) — những ngưỡng mà 25 luật
 * đọc thật lúc chạy, không phải tham số của bộ dò AI.
 *
 * **Khi tầng logic đổi, chỉ file này đổi.** `useRuleSettings.ts` và view đọc
 * năng lực qua đúng một đường là bộ giá trị cổng này trả về.
 */

import { EMPTY_RULE_CONFIG, type RuleConfig } from '@/domain/rules/config';

import type { RuleSettingsCapabilities } from './types';

/**
 * Hai thứ màn này không dựng, đóng băng lại thành một bản ghi đọc được.
 *
 * Cố ý **không** nằm trong `RuleSettingsCapabilities`: một năng lực chỉ có mặt
 * trong kiểu đó khi view có một mảnh giao diện để bật/tắt theo nó. Hai mục dưới
 * đây không có mảnh nào cả — chúng không bị ẩn đi, chúng không được dựng — nên
 * chỗ đúng của chúng là một bản ghi lý do, không phải một chữ `false` mà view
 * phải nhớ đừng đọc tới.
 */
export const RULE_SETTINGS_NOT_BUILT = Object.freeze({
  /** Đã có chủ: lựa chọn theo từng lượt chạy lại ở màn sơ đồ pipeline. */
  aiOverwritesUnapproved: false,
  /** Đã có chủ: `confidenceThreshold` của màn cài đặt dự án. */
  minimumConfidenceToAutoApprove: false,
});

/**
 * Câu nói rõ **ai** đổi được bộ luật, hiện khi màn ở chế độ chỉ đọc.
 *
 * Lấy đúng bảng phân quyền `project.settings.edit`
 * (`lib/auth/permissions.ts`): quản trị viên và kỹ sư được sửa, người xem thì
 * không. Nói ra vai được phép chứ không chỉ nói "bạn không có quyền" — người
 * đọc cần biết phải hỏi ai.
 */
export const RULE_SETTINGS_READ_ONLY_REASON =
  'chỉ quản trị viên và kỹ sư của dự án đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.';

export interface ReadRuleConfigInput {
  readonly projectId: string;
}

export interface UpdateRuleConfigInput {
  readonly projectId: string;
  readonly config: RuleConfig;
}

/** Ép cảnh cho bài kiểm, đúng khuôn `ruleReportGateway.ts`: tường minh, không biến ẩn. */
export interface RuleSettingsGatewaySeed {
  /**
   * Ghi đè quyền sửa của người dùng. Không truyền thì cổng dùng đúng giá trị
   * container đưa xuống — đây chỉ để bài kiểm dựng trạng thái 6 mà không phải
   * dựng cả một phiên đăng nhập.
   */
  readonly canEdit?: boolean;
  /**
   * Thay hẳn lượt đọc. Bài kiểm dựng trạng thái 4 (lỗi đọc) bằng một hàm trả
   * `Promise` bị từ chối — bộ nhớ trong file này không hỏng bao giờ, nên nếu
   * không có lối tiêm này thì trạng thái 4 sẽ không có cách nào chạm tới.
   */
  readonly read?: (input: ReadRuleConfigInput) => Promise<RuleConfig>;
  /** Thay hẳn lượt ghi, cùng lý do với {@link RuleSettingsGatewaySeed.read}. */
  readonly update?: (input: UpdateRuleConfigInput) => Promise<void>;
}

export interface RuleSettingsGateway {
  /**
   * Bộ năng lực của một lượt xem cài đặt.
   *
   * `canEdit` đến từ quyền của người dùng, do container đưa xuống. Cả hai năng
   * lực của màn đều suy ra từ đúng một chữ đó, vì cả hai đều ghi vào cùng một
   * `RuleConfig`.
   */
  readonly readCapabilities: (canEdit: boolean) => RuleSettingsCapabilities;
  /** Cấu hình đã lưu của dự án; `EMPTY_RULE_CONFIG` khi dự án chưa đổi gì. */
  readonly read: (input: ReadRuleConfigInput) => Promise<RuleConfig>;
  /** Một lượt tự lưu. Ném lỗi khi ghi hỏng — `createAutosave` thử lại theo lịch 5/15/45 giây. */
  readonly update: (input: UpdateRuleConfigInput) => Promise<void>;
}

/**
 * Cấu hình theo dự án, sống trong bộ nhớ của tiến trình này.
 *
 * Xem chú thích đầu file: đây là chỗ chứa tạm cho tới lượt **T-05**, không phải
 * một tầng dữ liệu. `Map` ở phạm vi module chứ không trong `createRuleSettingsGateway`,
 * để hai cổng dựng ở hai chỗ khác nhau trong cùng một phiên vẫn nhìn thấy cùng
 * một cấu hình — hai màn thấy hai bộ luật khác nhau đúng là thứ Đ3 tồn tại để chặn.
 */
const configByProject = new Map<string, RuleConfig>();

/** Bỏ hết cấu hình đang giữ. Bài kiểm gọi giữa hai lượt render để không rò trạng thái. */
export function resetRuleSettingsStore(): void {
  configByProject.clear();
}

/** Cổng thật của màn. Chữ ký này không đổi khi hai mục ở trên được nối dây. */
export function createRuleSettingsGateway(seed: RuleSettingsGatewaySeed = {}): RuleSettingsGateway {
  return {
    readCapabilities: (canEdit) => {
      const allowed = seed.canEdit ?? canEdit;

      return {
        canEditRules: allowed,
        canApplyPreset: allowed,
        readOnlyReason: allowed ? null : RULE_SETTINGS_READ_ONLY_REASON,
      };
    },

    read:
      seed.read ??
      (({ projectId }) => Promise.resolve(configByProject.get(projectId) ?? EMPTY_RULE_CONFIG)),

    update:
      seed.update ??
      (({ projectId, config }) => {
        configByProject.set(projectId, config);

        return Promise.resolve();
      }),
  };
}
