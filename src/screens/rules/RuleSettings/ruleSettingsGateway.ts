/**
 * Cổng của màn cài đặt bộ luật: nó được làm gì, và cấu hình nó sửa nằm ở đâu.
 *
 * Chép khuôn `ruleReportGateway.ts` của màn S-31: màn hỏi cổng này xem nó được
 * làm gì, và **năng lực nào `false` thì phần giao diện tương ứng rời khỏi DOM**
 * — không nút bị vô hiệu hoá, không ô trống, không ghi chú "sắp có".
 *
 * ## Cấu hình sống trên máy chủ: N21 đọc, N22 thay trọn (F-10)
 *
 * `read` gọi `GET /projects/{id}/rule-config`, `update` gọi `PUT` cùng đường với
 * `{ baseVersion, body: { overrides } }`. `baseVersion` là `revision` của MÁY CHỦ
 * — `RuleConfig.version` là bộ đếm phía client (khoá cache Đ4) và không bao giờ
 * lên dây.
 *
 * - Hỏng thì **ném nguyên** `HttpError`: `createAutosave` đọc nó để biết thử lại
 *   hay dừng (R2), và {@link describeRuleConfigSaveError} rẽ theo `code`.
 * - Hỏng vì mạng/timeout thì máy chủ có thể ĐÃ ghi. Cổng giữ đúng thân vừa gửi
 *   và gửi lại nó trước ở lượt `update` kế tiếp (C09b trả 200 cho lượt lặp), rồi
 *   mới gửi thân mới trên `revision` vừa nhận. Bản giữ sống trong cổng của lượt
 *   gắn màn, không ở cấp module: đổi người dùng là mất theo.
 *
 * ## Hai năng lực THẬT, đến từ quyền của người dùng
 *
 * `canEditRules` và `canApplyPreset` là `true` khi người dùng có quyền
 * `ruleset.edit` (`lib/auth/permissions.ts`, chỉ quản trị viên), vì **tầng logic có
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

import type { ApiClient } from '@/api/client';
import type { RuleConfig, RuleOverride } from '@/domain/rules/config';
import type { RuleCode } from '@/domain/rules/registry';
import { readWireError } from '@/lib/errors/wireError';
import { queryKeys } from '@/lib/query/queryKeys';

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
 * Lấy đúng bảng phân quyền `ruleset.edit` (`lib/auth/permissions.ts`): chỉ quản
 * trị viên. Nói ra vai được phép chứ không chỉ nói "bạn không có quyền" — người
 * đọc cần biết phải hỏi ai.
 */
export const RULE_SETTINGS_READ_ONLY_REASON =
  'Chỉ quản trị viên đổi được bộ luật; bạn đang xem ở quyền chỉ đọc.';

/**
 * Khoá của lượt đọc N21 — dùng chung cho màn cài đặt và màn báo cáo luật, nên
 * `setQueryData` sau một lượt lưu làm báo cáo chạy lại theo `revision` mới.
 *
 * Nằm dưới `project.detail(id)`: một lần vô hiệu hoá khoá cha kéo theo cả khoá
 * này (`src/lib/query` nằm ngoài phạm vi của lượt này).
 */
export const ruleSettingsQueryKey = (projectId: string) =>
  [...queryKeys.project.detail(projectId), 'ruleConfig'] as const;

/** Một lượt đọc/ghi thành công: `revision` của máy chủ cộng cấu hình miền. */
export interface LoadedRuleConfig {
  readonly revision: number;
  readonly config: RuleConfig;
}

export interface ReadRuleConfigInput {
  readonly projectId: string;
  readonly signal?: AbortSignal;
}

export interface UpdateRuleConfigInput {
  readonly projectId: string;
  /** `revision` máy chủ vừa đọc/lưu. */
  readonly baseVersion: number;
  readonly config: RuleConfig;
}

/** Ép cảnh cho bài kiểm, đúng khuôn `ruleReportGateway.ts`: tường minh, không biến ẩn. */
export interface RuleSettingsGatewaySeed {
  /**
   * Ghi đè quyền sửa của người dùng. Không truyền thì cổng dùng đúng giá trị
   * hook đưa xuống — đây chỉ để bài kiểm dựng chế độ chỉ đọc mà không phải dựng
   * cả một phiên đăng nhập.
   */
  readonly canEdit?: boolean;
  /** Client của lượt này; vắng thì `createAppApiClient()`, nạp lười ở lượt gọi đầu. */
  readonly client?: ApiClient;
}

export interface RuleSettingsGateway {
  /**
   * Bộ năng lực của một lượt xem cài đặt.
   *
   * Cả hai năng lực của màn đều suy ra từ đúng một chữ `canEdit`, vì cả hai đều
   * ghi vào cùng một `RuleConfig`.
   */
  readonly readCapabilities: (canEdit: boolean) => RuleSettingsCapabilities;
  /** N21. Chưa lưu lần nào → `revision: 0`, không override nào. */
  readonly read: (input: ReadRuleConfigInput) => Promise<LoadedRuleConfig>;
  /** N22. Ném nguyên `HttpError` khi hỏng. */
  readonly update: (input: UpdateRuleConfigInput) => Promise<LoadedRuleConfig>;
  /** `revision` của lượt đọc/ghi thành công gần nhất cho dự án này. */
  readonly lastRevision: (projectId: string) => number | undefined;
}

type WireOverrides = Record<RuleCode, RuleOverride>;

interface HeldWrite {
  readonly baseVersion: number;
  readonly body: { readonly overrides: WireOverrides };
}

/**
 * `overrides` lên dây: bỏ mục không đổi gì và `thresholds: {}` — hai refine của
 * `RuleOverrideSchema` từ chối cả hai.
 */
const toWireOverrides = (config: RuleConfig): WireOverrides => {
  const overrides: WireOverrides = {};

  for (const [code, override] of Object.entries(config.overrides)) {
    const hasThresholds =
      override.thresholds !== undefined && Object.keys(override.thresholds).length > 0;
    const next: RuleOverride = {
      ...(override.enabled !== undefined ? { enabled: override.enabled } : {}),
      ...(override.severity !== undefined ? { severity: override.severity } : {}),
      ...(hasThresholds && override.thresholds !== undefined ? { thresholds: override.thresholds } : {}),
    };

    if (Object.keys(next).length > 0) {
      overrides[code] = next;
    }
  }

  return overrides;
};

/** Lỗi mà máy chủ có thể đã ghi xong trước khi câu trả lời mất: mạng đứt, quá hạn. */
const isLostResponse = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'kind' in error &&
  (error.kind === 'network' || error.kind === 'timeout');

/** Cổng thật của màn. */
export function createRuleSettingsGateway(seed: RuleSettingsGatewaySeed = {}): RuleSettingsGateway {
  // Nạp LƯỜI: `appClient` kéo theo cả phiên đăng nhập (~24 KiB gzip). Nhập tĩnh thì
  // chunk màn báo cáo luật vượt trần 280 KiB của cổng kích thước (đo F-10: 280,3).
  let clientPromise: Promise<ApiClient> | null = seed.client === undefined ? null : Promise.resolve(seed.client);
  const getClient = (): Promise<ApiClient> => {
    clientPromise ??= import('@/api/appClient').then((module) => module.createAppApiClient());

    return clientPromise;
  };
  const revisions = new Map<string, number>();
  const held = new Map<string, HeldWrite>();

  const toLoaded = (
    projectId: string,
    wire: { readonly revision: number; readonly overrides: WireOverrides },
  ): LoadedRuleConfig => {
    revisions.set(projectId, wire.revision);

    return { revision: wire.revision, config: { overrides: wire.overrides, version: 0 } };
  };

  const send = async (projectId: string, write: HeldWrite): Promise<LoadedRuleConfig> => {
    const client = await getClient();
    const result = await client.ruleConfig.replace({
      projectId,
      baseVersion: write.baseVersion,
      body: write.body,
    });

    if (!result.ok) {
      if (isLostResponse(result.error)) {
        held.set(projectId, write);
      } else {
        held.delete(projectId);
      }

      throw result.error;
    }

    held.delete(projectId);

    return toLoaded(projectId, result.data);
  };

  return {
    readCapabilities: (canEdit) => {
      const allowed = seed.canEdit ?? canEdit;

      return {
        canEditRules: allowed,
        canApplyPreset: allowed,
        readOnlyReason: allowed ? null : RULE_SETTINGS_READ_ONLY_REASON,
      };
    },

    read: async ({ projectId, signal }) => {
      const client = await getClient();
      const result = await client.ruleConfig.read({
        projectId,
        ...(signal !== undefined ? { signal } : {}),
      });

      if (!result.ok) {
        throw result.error;
      }

      return toLoaded(projectId, result.data);
    },

    update: async ({ projectId, baseVersion, config }) => {
      const body = { overrides: toWireOverrides(config) };
      const previous = held.get(projectId);

      if (previous === undefined) {
        return send(projectId, { baseVersion, body });
      }

      // Lượt trước mất câu trả lời: gửi lại ĐÚNG thân ấy trước, rồi mới gửi thân mới.
      const resent = await send(projectId, previous);

      if (JSON.stringify(previous.body) === JSON.stringify(body)) {
        return resent;
      }

      return send(projectId, { baseVersion: resent.revision, body });
    },

    lastRevision: (projectId) => revisions.get(projectId),
  };
}

/* -------------------------------------------------------------------------- */
/* Câu của một lượt lưu hỏng — rẽ theo `code`, không theo status trần.          */
/* -------------------------------------------------------------------------- */

export interface RuleConfigSaveProblem {
  readonly message: string;
  /** Câu gắn vào thẻ "Ngưỡng chung" (lỗi ở `body.overrides.GENERAL…`). */
  readonly onGeneralCard: boolean;
  /** Mời tải lại bản của máy chủ (409). */
  readonly offerReload: boolean;
}

const SAVE_PROBLEM_TEXT: Readonly<Record<string, string>> = Object.freeze({
  VERSION_CONFLICT:
    'Bộ luật vừa được đổi ở nơi khác nên thay đổi của bạn chưa được lưu. Tải lại để xem bản mới nhất.',
  RULE_CODE_UNKNOWN: 'Máy chủ không nhận ra một luật trong bộ luật này nên thay đổi chưa được lưu.',
  RULE_THRESHOLD_UNKNOWN:
    'Máy chủ không nhận ra một ngưỡng trong bộ luật này nên thay đổi chưa được lưu.',
  RULE_THRESHOLD_OUT_OF_RANGE:
    'Một ngưỡng nằm ngoài khoảng máy chủ cho phép nên thay đổi chưa được lưu.',
  RULE_GENERAL_NOT_TOGGLEABLE: 'Ngưỡng chung chỉ đổi được con số, không bật, tắt hay đổi mức được.',
  VALIDATION: 'Máy chủ từ chối bộ luật vì dữ liệu không hợp lệ nên thay đổi chưa được lưu.',
  FORBIDDEN: 'Vai của bạn không còn quyền đổi bộ luật.',
});

const SAVE_PROBLEM_FALLBACK = 'Chưa lưu được bộ luật của dự án này.';
const SAVE_PROBLEM_CONNECTION = 'Mất kết nối nên bộ luật chưa được lưu.';
const GENERAL_FIELD_PREFIX = 'body.overrides.GENERAL';

/** Một lỗi của N22 thành câu người đọc — không in mã. */
export function describeRuleConfigSaveError(error: unknown): RuleConfigSaveProblem {
  const wire = readWireError(error);
  const code = wire?.code;
  const known = code !== undefined ? SAVE_PROBLEM_TEXT[code] : undefined;
  const message = known ?? (isLostResponse(error) ? SAVE_PROBLEM_CONNECTION : SAVE_PROBLEM_FALLBACK);

  return {
    message,
    onGeneralCard: wire?.field?.startsWith(GENERAL_FIELD_PREFIX) === true,
    offerReload: code === 'VERSION_CONFLICT',
  };
}
