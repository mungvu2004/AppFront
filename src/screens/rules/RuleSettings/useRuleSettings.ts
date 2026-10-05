/**
 * Toàn bộ phần suy nghĩ của màn cài đặt bộ luật (S-35).
 *
 * Mục D chia đôi: file này giữ trạng thái và làm mọi phép tính, `RuleSettings.tsx`
 * chỉ vẽ. Mọi chuỗi người dùng đọc — "Đang ảnh hưởng 7 đối tượng", câu báo lỗi
 * của một ô ngưỡng, câu cảnh báo khi tắt sạch luật — đã dựng xong ở đây, nên
 * view không còn gì để làm tròn hay ghép (bất biến A15).
 *
 * ## Bốn thứ file này NỐI LẠI chứ không dựng lại
 *
 * - **Danh sách luật** — `createDefaultRuleRegistry()` + `resolveRules()`. Màn
 *   không khai một mã luật nào, không đếm cứng 25, không viết lại một câu luật
 *   nào: `RuleSettingsRow.sentence` là `Rule.name` nguyên văn (sổ đăng ký đã
 *   viết sẵn một câu tiếng Việt viết thường cho mỗi luật).
 * - **Ngưỡng** — `RULE_THRESHOLD_SPECS` và `validateThreshold` của
 *   `@/domain/rules/config`. Biên `min`/`max`, bước nhảy và câu báo lỗi đều là
 *   của domain; màn chỉ chọn ô nào hiện ở thẻ nào.
 * - **Bộ luật sẵn** — `RULE_PRESETS` và `diffPreset` của `@/domain/rules/presets`.
 *   Số luật sẽ đổi hiện ra **trước** khi người dùng bấm, và đó là con số đo
 *   được chứ không phải một lời hứa.
 * - **Ảnh hưởng thật** — `selectRuleImpactCounts` của store, tức số vi phạm mà
 *   chính lượt chạy luật trên mô hình đang mở sinh ra.
 *
 * ## Ghi cấu hình: `commitRuleConfig`, KHÔNG phải `commit()`
 *
 * `store/commit.ts` nhận `SpatialPatch` rồi áp lên slice `spatial` — nó không
 * mang được một `RuleConfig`. Cấu hình luật đi qua cửa ghi có tên
 * `commitRuleConfig(next, label)` của `src/store` (sửa hợp đồng #1, tên chốt lại
 * ở sửa hợp đồng #2). A10 vẫn nguyên: màn không gọi `set()` của store lần nào.
 * Cửa ấy trả về `RuleConfigCommit` mang sẵn `undo()` đóng gói cấu hình TRƯỚC
 * lượt ghi, nên vé hoàn tác dưới đây dùng thẳng nó thay vì tự chụp bản cũ —
 * tự chụp thì hai lượt sửa liên tiếp có thể lưu cùng một "bản trước".
 *
 * ## Hoàn tác: vé D-05, KHÔNG phải lịch sử toàn cục
 *
 * `src/store/index.ts` khai zundo `partialize` chỉ theo dõi `{ spatial }`, và
 * **không được nới**: nhét cấu hình luật vào ngăn xếp ấy thì một lần Ctrl+Z sau
 * khi kéo tường có thể hoàn tác một cái Toggle luật, ở mọi màn đã xong. Nên A8
 * ở đây đi bằng {@link createUndoTicket}: mỗi thay đổi giữ lại bản `RuleConfig`
 * TRƯỚC đó và trả về qua toast trong `UNDO_WINDOW_MS` (8 giây — hằng của
 * `@/lib/mutations/undoTicket`, con số không viết lại ở đây).
 *
 * ## Tự lưu: A7, không có nút Lưu
 *
 * `createAutosave` + `useSaveIndicator`, **không** truyền `debounceMs`: 800 ms
 * mặc định của `createAutosave` chính là con số của A7, viết lại là tạo một bản
 * sao sẽ lệch. Lượt lưu đi tới `ruleSettingsGateway` — đọc chú thích đầu file
 * đó để biết nó lưu được tới đâu và vì sao (chưa qua mạng, mã lượt **T-05**).
 *
 * ## Hai thứ CỐ Ý không có ở màn này
 *
 * Toggle "cho phép lần chạy AI mới ghi đè mục chưa duyệt" và ô "độ tin cậy tối
 * thiểu để tự duyệt" — cả hai đã có chủ ở nơi khác. Lý do đầy đủ nằm ở
 * `ruleSettingsGateway.ts`; ở đây không có một dòng nào cho chúng, kể cả một
 * dòng bị tắt.
 */

import { lowerFirst } from '@/lib/format/sentence';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  GENERAL_THRESHOLD_CODE,
  isDefaultConfig,
  resetConfig,
  resolveRules,
  setGroupEnabled,
  setRuleEnabled,
  setRuleSeverity,
  setRuleThreshold,
  type ResolvedRule,
  type RuleConfig,
  type RuleThresholdSpec,
} from '@/domain/rules/config';
import {
  RULE_THRESHOLD_SPECS,
  thresholdSpecsFor,
  validateThreshold,
} from '@/domain/rules/thresholdSpecs';
import { createDefaultRuleRegistry } from '@/domain/rules/defaults';
import { SUPERSEDED_BUILT_IN_CODES } from '@/domain/rules/function';
import { diffPreset, RULE_PRESETS, type RulePreset } from '@/domain/rules/presets';
import {
  RULE_GROUP_LABELS,
  RULE_GROUPS,
  type RuleCode,
  type RuleGroup,
  type RuleRegistry,
  type RuleScope,
  type RuleSeverity,
} from '@/domain/rules/registry';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import { useSession } from '@/hooks/useSession';
import { createAutosave } from '@/lib/autosave/createAutosave';
import { toSaveIndicatorState } from '@/lib/autosave/toSaveIndicatorState';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError } from '@/lib/errors';
import { isTransientWireError, readWireError } from '@/lib/errors/wireError';
import { formatNumber } from '@/lib/format/number';
import type { Announcer } from '@/lib/input/announcer';
import { createUndoTicket, type UndoTicket } from '@/lib/mutations/undoTicket';
import { useStore } from '@/store';
import { selectRuleConfig, selectRuleImpactCounts } from '@/store/selectors';
import type { ProjectRole } from '@/types/project';

import {
  createRuleSettingsGateway,
  describeRuleConfigSaveError,
  ruleSettingsQueryKey,
  type LoadedRuleConfig,
  type RuleConfigSaveProblem,
  type RuleSettingsGateway,
} from './ruleSettingsGateway';

export { ruleSettingsQueryKey };
import type {
  BuildingKind,
  RuleSettingsGroup,
  RuleSettingsPresetOption,
  RuleSettingsProps,
  RuleSettingsRow,
  RuleSettingsStatus,
  RuleSettingsThreshold,
  RuleSettingsViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Chữ ký công khai.                                                           */
/* -------------------------------------------------------------------------- */

/** Toast hoàn tác của A8. Màn không tự dựng lớp toast; vỏ ứng dụng tiêm vào. */
export interface RuleSettingsToast {
  readonly message: string;
  readonly onUndo: () => void;
  /** Đúng vé của lượt sửa — để vỏ đưa vào `notificationBus` mà không dựng vé thứ hai. */
  readonly undoTicket: UndoTicket;
}

export interface UseRuleSettingsOptions {
  readonly projectId: string;
  /** Không truyền thì hook dựng cổng thật; bài kiểm tiêm cổng của nó vào. */
  readonly gateway?: RuleSettingsGateway;
  /** Ghi đè quyền sửa; vắng thì `can('edit', 'ruleset', { roles })` theo vai của người dùng. */
  readonly canEdit?: boolean;
  /** Trạng thái 7: vỏ ứng dụng báo đang thu gọn. */
  readonly isCompact?: boolean;
  /**
   * Nơi nhận toast hoàn tác. Vắng mặt thì thay đổi vẫn hoàn tác được bằng vé —
   * chỉ là không ai mời người dùng bấm.
   */
  readonly onToast?: (toast: RuleSettingsToast) => void;
  readonly now?: () => number;
  readonly isOnline?: () => boolean;
  readonly announcer?: Announcer;
}

/* -------------------------------------------------------------------------- */
/* Nhãn và câu — thứ duy nhất màn này tự viết.                                 */
/* -------------------------------------------------------------------------- */

/**
 * Hậu tố đơn vị hiện ngay trong ô nhập.
 *
 * `RuleThresholdSpec.unit` là định danh tiếng Anh không dấu (mục E.11); đây là
 * chỗ duy nhất nó thành ký hiệu người đọc. Phép đổi này thuộc viewmodel chứ
 * không thuộc view (A15).
 */
/**
 * Hậu tố người đọc thấy sau con số của một ô ngưỡng.
 *
 * `'tile'` của domain là một tỉ lệ trần 0..1 — `MIN_SUPPORT_SHARE = 0,8` — và
 * domain giữ đúng con số mà luật đo, nên `thresholdUnitText('tile')` trả về
 * chuỗi rỗng chứ không dám ghi `%` cạnh `0,8`. Việc đưa `0,8` thành `80 %` là
 * một quyết định ĐỊNH DẠNG, và A15 đặt định dạng ở viewmodel: đúng chỗ này.
 * Thiếu bước ấy thì ô hiện `0,8 %`, sai đúng một trăm lần.
 */
const UNIT_SUFFIX: Readonly<Record<RuleThresholdSpec['unit'], string>> = Object.freeze({
  mm: 'mm',
  m2: 'm²',
  do: '°',
  phantram: '%',
  tile: '%',
});

/** Một tỉ lệ 0..1 hiện trên màn dưới dạng phần trăm. */
const PERCENT_SCALE = 100;

/**
 * Cắt sai số dấu phẩy động của phép nhân trăm.
 *
 * `0,8 * 100` trong IEEE-754 ra `80.00000000000001`, và một ô ngưỡng in ra con
 * số đó là một ô hỏng. Sáu chữ số thập phân dư sức cho một bước nhảy nhỏ nhất
 * là năm phần trăm.
 */
const ROUNDING_STEPS = 1_000_000;

/** Số nhân giữa miền của domain và con số hiện trên ô. 1 với mọi đơn vị trừ `'tile'`. */
const displayScale = (unit: RuleThresholdSpec['unit']): number =>
  unit === 'tile' ? PERCENT_SCALE : 1;

/** Miền của domain → con số trên ô. */
const toDisplayValue = (spec: RuleThresholdSpec, value: number): number =>
  Math.round(value * displayScale(spec.unit) * ROUNDING_STEPS) / ROUNDING_STEPS;

/** Con số người dùng gõ → miền của domain, đường ngược của {@link toDisplayValue}. */
const toDomainValue = (spec: RuleThresholdSpec, shown: number): number =>
  Math.round((shown / displayScale(spec.unit)) * ROUNDING_STEPS) / ROUNDING_STEPS;

/** Phạm vi một luật soi, thành câu. `RuleScope` không có bảng nhãn nào trong repo. */
const SCOPE_PHRASE: Readonly<Record<RuleScope, string>> = Object.freeze({
  level: 'Soi trên từng tầng',
  building: 'Soi trên cả công trình',
});

/**
 * Luật nào thay thế luật nào.
 *
 * Domain giữ **danh sách** luật bị thay thế (`SUPERSEDED_BUILT_IN_CODES`, nhập
 * thẳng ở dưới chứ không chép lại) nhưng ghi cặp thay thế chỉ trong văn xuôi của
 * chú thích (`domain/rules/function/index.ts:16-19`: `ROOM-NO-DOOR` và
 * `ROOM-AREA-BELOW-MINIMUM` là bản đầy đủ hơn của `ROOM-HAS-DOOR` và
 * `ROOM-MIN-AREA`). Bảng này chỉ cung cấp nửa còn thiếu ấy. Nếu domain thêm một
 * mã bị thay thế thứ ba mà quên bảng này thì `supersededBy` của nó là `null` —
 * luật vẫn hiện, chỉ là không nói được ai thay nó, chứ màn không bịa ra một mã.
 */
const SUPERSEDED_BY: Readonly<Record<string, RuleCode>> = Object.freeze({
  'ROOM-HAS-DOOR': 'ROOM-NO-DOOR',
  'ROOM-MIN-AREA': 'ROOM-AREA-BELOW-MINIMUM',
});

const IMPACT_UNKNOWN_CAPTION = 'Chưa có dữ liệu để đánh giá';

/**
 * Câu cảnh báo hậu quả khi mọi luật đều tắt.
 *
 * "Không cho tắt toàn bộ luật mà không có một câu cảnh báo về hậu quả" — và hậu
 * quả thật không phải "bạn sẽ mất phần kiểm tra", mà là mô hình sẽ **báo sạch
 * lỗi** trong khi chưa có gì được kiểm. Đó mới là thứ làm người ta xuất nhầm.
 */
const DISABLE_ALL_WARNING =
  'Mọi luật đều đang tắt: lượt kiểm tra sẽ không soi gì nữa và mô hình báo sạch lỗi dù chưa được kiểm lần nào.';

const LOAD_FAILURE_FALLBACK = 'Không tải được cài đặt bộ luật của dự án này.';

/** N21 trả 403: người này không còn là thành viên đọc được dự án. */
const FORBIDDEN_STATUS = 403;

/* -------------------------------------------------------------------------- */
/* Dựng viewmodel từ dữ liệu thật.                                             */
/* -------------------------------------------------------------------------- */

/** Mọi ngưỡng theo khoá, để `onChangeThreshold(code, key, value)` tra ngược ra spec. */
const specsByKey = (): ReadonlyMap<string, RuleThresholdSpec> => {
  const byKey = new Map<string, RuleThresholdSpec>();

  for (const spec of RULE_THRESHOLD_SPECS) {
    byKey.set(spec.key, spec);
  }

  return byKey;
};

/** Khoá của một ô ngưỡng trong bảng lỗi: hai luật có thể cùng dùng một khoá ngưỡng. */
const errorKeyOf = (code: RuleCode, key: string): string => `${code}::${key}`;

/**
 * Một spec của domain thành một ô trên màn.
 *
 * `value` vào đây là con số của DOMAIN; cả bốn con số đi ra đều đã qua thang
 * hiển thị, nên biên của ô và giá trị của ô luôn cùng một đơn vị. Đổi thang cho
 * `value` mà quên `min`/`max` là cách chắc chắn nhất để một ô hợp lệ hiện viền
 * đỏ.
 */
const toThreshold = (
  spec: RuleThresholdSpec,
  value: number,
  error: string | null,
): RuleSettingsThreshold => ({
  key: spec.key,
  label: spec.label,
  unit: UNIT_SUFFIX[spec.unit],
  value: toDisplayValue(spec, value),
  min: toDisplayValue(spec, spec.min),
  max: toDisplayValue(spec, spec.max),
  step: toDisplayValue(spec, spec.step),
  error,
});

/**
 * Câu báo ngoài khoảng, viết bằng đúng đơn vị người dùng đang nhìn.
 *
 * `validateThreshold` là nơi quyết định một con số CÓ chạy được không, và câu
 * của nó nêu khoảng bằng đơn vị của domain — với `'tile'` là "từ 0,5 đến 1",
 * đọc lệch hẳn với một ô đang hiện 80 %. Nên domain vẫn giữ quyền phán đúng
 * sai, còn câu chữ thì dựng lại ở đây theo đúng khuôn của
 * `outOfRangeMessage` — A15 lần nữa: định dạng ở viewmodel.
 */
const outOfRangeText = (spec: RuleThresholdSpec, fallback: string): string => {
  if (displayScale(spec.unit) === 1) {
    return fallback;
  }

  const low = formatNumber(toDisplayValue(spec, spec.min), { maxFractionDigits: 2 });
  const high = formatNumber(toDisplayValue(spec, spec.max), { maxFractionDigits: 2 });

  return `${spec.label} nhận giá trị từ ${low} đến ${high} ${UNIT_SUFFIX[spec.unit]}.`;
};

/**
 * Câu mô tả một luật, ghép từ dữ liệu THẬT của chính nó.
 *
 * Sổ đăng ký không có trường `description`, và bịa một câu giới thiệu cho từng
 * luật là đúng thứ "không khai báo lại danh sách luật trong màn" cấm. Nên câu
 * này chỉ nói hai điều đọc được từ `Rule`: nó soi ở phạm vi nào, và nó có ngưỡng
 * nào chỉnh được.
 */
const describeRule = (resolved: ResolvedRule, specs: readonly RuleThresholdSpec[]): string => {
  const scope = SCOPE_PHRASE[resolved.rule.scope];

  if (specs.length === 0) {
    return `${scope} · không có ngưỡng chỉnh được`;
  }

  return `${scope} · chỉnh được: ${specs.map((spec) => spec.label).join(', ')}`;
};

/** `Đang ảnh hưởng 7 đối tượng`, hoặc câu "chưa có dữ liệu" khi chưa có mô hình. */
const describeImpact = (count: number | null): string =>
  count === null ? IMPACT_UNKNOWN_CAPTION : `Đang ảnh hưởng ${formatNumber(count)} đối tượng`;

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Những gì lượt tự lưu cần đọc lúc nó chạy, luôn là bản mới nhất ("ref mới nhất"). */
interface AutosaveBridge {
  readonly getChanges: () => RuleConfig | undefined;
  readonly save: (config: RuleConfig) => Promise<void>;
}

/** Bản đã lưu (hoặc vừa nạp) của đúng một dự án — mốc để biết có sửa dở không. */
interface PersistedConfig {
  readonly projectId: string;
  readonly config: RuleConfig;
}

/**
 * Bản chụp khi màn tháo (hoặc đổi dự án) lúc còn sửa chưa lưu — R13.
 *
 * Lượt xả đi bằng `projectId` và `revision` đã chụp, KHÔNG đọc store: lượt xoá
 * khi đổi dự án có thể đã đặt lại store, và một lượt đang bay sẽ nâng `revision`.
 */
interface PendingFlush {
  readonly projectId: string;
  readonly revision: number;
  readonly config: RuleConfig;
}

/** Cờ "đã tháo" của cầu tự lưu, kèm bản chụp đang chờ gửi. */
interface FlushState {
  disposed: boolean;
  pending: PendingFlush | null;
}

/**
 * Trả về ĐÚNG bộ props của view, không thừa trường nào.
 *
 * Container chỉ việc:
 * `const props = useRuleSettings({ projectId }); return <RuleSettings {...props} />;`
 */
export function useRuleSettings(options: UseRuleSettingsOptions): RuleSettingsProps {
  const { projectId, isCompact = false } = options;

  // Vai theo dự án đang mở là nguồn đúng nhất; phiên là nguồn dự phòng khi
  // chưa ai đặt `userRoles` — khuôn `VersionHistory.container.tsx`.
  const session = useSession();
  const storeRoles = useStore((state) => state.userRoles);
  const roles: readonly ProjectRole[] = storeRoles.length > 0 ? storeRoles : session.roles;
  const canEdit = options.canEdit ?? can('edit', 'ruleset', { roles });

  const injectedGateway = options.gateway;
  const gateway = useMemo<RuleSettingsGateway>(
    () => injectedGateway ?? createRuleSettingsGateway(),
    [injectedGateway],
  );
  const capabilities = useMemo(() => gateway.readCapabilities(canEdit), [gateway, canEdit]);
  const queryClient = useQueryClient();

  // Một sổ đăng ký riêng cho lượt xem này, dựng đúng một lần. Bộ mặc định đã tự
  // tắt hai luật built-in bị nhóm chức năng thay thế, nên số luật là việc của
  // domain chứ không phải của màn.
  const registry = useMemo<RuleRegistry>(() => createDefaultRuleRegistry(), []);
  const specByKey = useMemo(specsByKey, []);

  const config = useStore(selectRuleConfig);
  const ruleConfigProjectId = useStore((state) => state.ruleConfigProjectId);
  const impactCounts = useStore(selectRuleImpactCounts);
  const graph = useStore((state) => state.spatial);
  const spatialLoading = useStore((state) => state.spatialLoading);

  const [thresholdErrors, setThresholdErrors] = useState<Readonly<Record<string, string>>>({});
  const [saveProblem, setSaveProblem] = useState<RuleConfigSaveProblem | null>(null);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState(false);

  /* ---------------------------------------------------------------------- */
  /* Đọc cấu hình đã lưu (N21), và nạp vào store.                            */
  /* ---------------------------------------------------------------------- */

  const configQuery = useQuery({
    queryKey: ruleSettingsQueryKey(projectId),
    queryFn: ({ signal }): Promise<LoadedRuleConfig> => gateway.read({ projectId, signal }),
  });

  const lastPersistedRef = useRef<PersistedConfig | null>(null);
  const loaded = configQuery.data ?? null;

  /** Có sửa của dự án này chưa lưu không. */
  const hasUnsavedEdits = useCallback((): boolean => {
    const persisted = lastPersistedRef.current;
    const state = useStore.getState();

    return (
      persisted !== null &&
      persisted.projectId === projectId &&
      state.ruleConfigProjectId === projectId &&
      state.ruleConfig !== persisted.config
    );
  }, [projectId]);

  /**
   * Nạp một bản N21 vào store. KHÔNG đi qua `commitRuleConfig`: một lượt nạp
   * không phải thay đổi của người dùng — không nhãn lịch sử, không toast mời
   * "hoàn tác", không đánh thức bộ tự lưu.
   */
  const hydrate = useCallback(
    (next: LoadedRuleConfig): void => {
      useStore.getState().hydrateRuleConfig({
        projectId,
        revision: next.revision,
        overrides: next.config.overrides,
      });
      // Slice dựng object mới, nên mốc là bản trong store chứ không phải `next.config`.
      lastPersistedRef.current = { projectId, config: useStore.getState().ruleConfig };
    },
    [projectId],
  );

  useEffect(() => {
    if (loaded === null) {
      return;
    }

    const state = useStore.getState();
    const persisted = lastPersistedRef.current;

    if (state.ruleConfigProjectId !== projectId) {
      hydrate(loaded);
      return;
    }

    // Layout (F-04a) đã nạp store cho dự án này: chỉ đặt mốc, không nạp đè.
    if (persisted === null || persisted.projectId !== projectId) {
      if (loaded.revision > state.ruleConfigRevision) {
        hydrate(loaded);
      } else {
        lastPersistedRef.current = { projectId, config: state.ruleConfig };
      }

      return;
    }

    if (loaded.revision > state.ruleConfigRevision && !hasUnsavedEdits()) {
      hydrate(loaded);
    }
  }, [hasUnsavedEdits, hydrate, loaded, projectId]);

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (A7) — 800 ms mặc định của createAutosave, không viết lại số.    */
  /* ---------------------------------------------------------------------- */

  const bridgeRef = useRef<AutosaveBridge>({
    getChanges: () => undefined,
    save: async () => undefined,
  });
  const flushRef = useRef<FlushState>({ disposed: false, pending: null });

  const [autosave] = useState(() =>
    createAutosave<RuleConfig>({
      getChanges: () => bridgeRef.current.getChanges(),
      save: (changes) => bridgeRef.current.save(changes),
      ...(options.now !== undefined ? { now: options.now } : {}),
      ...(options.isOnline !== undefined ? { isOnline: options.isOnline } : {}),
    }),
  );

  const indicator = useSaveIndicator(autosave, {
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.announcer !== undefined ? { announcer: options.announcer } : {}),
  });

  useEffect(() => {
    const savePending = async (pending: PendingFlush): Promise<void> => {
      const persisted = lastPersistedRef.current;

      // Tháo khi lượt thường đang bay mà không sửa thêm: bản chụp CHÍNH là thân lượt ấy
      // vừa lưu xong — không gửi lần hai (revision sẽ tăng vô ích).
      if (persisted !== null && persisted.projectId === pending.projectId && persisted.config === pending.config) {
        flushRef.current.pending = null;
        return;
      }

      try {
        const saved = await gateway.update({
          projectId: pending.projectId,
          baseVersion: Math.max(gateway.lastRevision(pending.projectId) ?? 0, pending.revision),
          config: pending.config,
        });

        if (flushRef.current.pending === pending) {
          flushRef.current.pending = null;
        }

        useStore.getState().setRuleConfigRevision(pending.projectId, saved.revision);
        queryClient.setQueryData(ruleSettingsQueryKey(pending.projectId), saved);
      } catch (error) {
        // Hỏng vĩnh viễn thì `createAutosave` dừng ở `failed` và không gửi lại (R2):
        // bỏ bản chụp để lượt sau của màn không mang theo nó.
        if (!isTransientWireError(error) && flushRef.current.pending === pending) {
          flushRef.current.pending = null;
        }

        throw error;
      }
    };

    bridgeRef.current = {
      getChanges: () => {
        const flush = flushRef.current;

        if (flush.pending !== null) {
          return flush.pending.config;
        }

        if (flush.disposed || !hasUnsavedEdits()) {
          return undefined;
        }

        return useStore.getState().ruleConfig;
      },
      save: async (changes) => {
        const pending = flushRef.current.pending;

        if (pending !== null) {
          await savePending(pending);
          return;
        }

        // Đọc TRƯỚC `await` đầu tiên: lượt nạp hay lượt lưu khác có thể nâng nó giữa chừng.
        const baseVersion = useStore.getState().ruleConfigRevision;

        try {
          const saved = await gateway.update({ projectId, baseVersion, config: changes });
          // Hook đã sang dự án khác giữa chừng thì mốc và dải lỗi thuộc dự án mới, không ghi đè.
          const stillHere = useStore.getState().ruleConfigProjectId === projectId;

          if (stillHere) {
            lastPersistedRef.current = { projectId, config: changes };
            setSaveProblem(null);
          }

          useStore.getState().setRuleConfigRevision(projectId, saved.revision);
          queryClient.setQueryData(ruleSettingsQueryKey(projectId), saved);
        } catch (error) {
          if (useStore.getState().ruleConfigProjectId === projectId) {
            setSaveProblem(describeRuleConfigSaveError(error));
          }

          // Lỗi GỐC: `createAutosave` đọc nó để chọn thử lại hay dừng (R2).
          throw error;
        }
      },
    };
  });

  // R13: rời dự án (tháo màn hay đổi `projectId`) khi còn sửa chưa lưu → chụp
  // ĐỒNG BỘ rồi xả ngay một lượt; engine đang gửi thì lượt chạy lại đọc bản chụp.
  useEffect(() => {
    const flush = flushRef.current;
    flush.disposed = false;

    return () => {
      const state = autosave.getState();

      if (state !== 'saved' && state !== 'failed') {
        const changes = bridgeRef.current.getChanges();

        if (changes !== undefined && flush.pending === null) {
          const store = useStore.getState();

          flush.pending = {
            projectId,
            revision: store.ruleConfigProjectId === projectId ? store.ruleConfigRevision : 0,
            config: changes,
          };
        }

        flush.disposed = true;
        void autosave.saveNow();
        return;
      }

      flush.disposed = true;
    };
  }, [autosave, projectId]);

  /* ---------------------------------------------------------------------- */
  /* Tải lại bản của máy chủ (409) — hỏi trước khi bỏ sửa dở (A9).           */
  /* ---------------------------------------------------------------------- */

  const reload = useCallback(async (): Promise<void> => {
    const result = await configQuery.refetch();

    // Lượt đọc lại hỏng thì react-query vẫn trả `data` cũ: không nạp nó, giữ dải lỗi.
    if (result.isSuccess) {
      hydrate(result.data);
      setSaveProblem(null);
      // Xoá trạng thái `failed` của lượt lưu cũ: không còn gì để gửi.
      void autosave.saveNow();
    }
  }, [autosave, configQuery, hydrate]);

  const onReload = useCallback((): void => {
    if (hasUnsavedEdits()) {
      setReloadConfirmOpen(true);
      return;
    }

    void reload();
  }, [hasUnsavedEdits, reload]);

  const onConfirmReload = useCallback((): void => {
    setReloadConfirmOpen(false);
    void reload();
  }, [reload]);

  const onCancelReload = useCallback((): void => {
    setReloadConfirmOpen(false);
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Một thay đổi: ghi vào store, đánh thức tự lưu, phát vé hoàn tác.        */
  /* ---------------------------------------------------------------------- */

  const nowOption = options.now;
  const onToast = options.onToast;
  const canEditRules = capabilities.canEditRules;

  const applyConfig = useCallback(
    (next: RuleConfig, label: string, toastMessage: string): void => {
      if (!canEditRules) {
        return;
      }

      // Cửa ghi trả về `undo()` đã đóng gói cấu hình trước lượt này, nên màn
      // không tự chụp lại bản cũ: chụp tay thì hai lượt sửa nối nhau trong cùng
      // một lượt render đều nhớ cùng một "bản trước" và vé thứ hai lùi quá xa.
      const result = useStore.getState().commitRuleConfig(next, label);
      autosave.notifyChange();

      // A8: đúng một vé cho mỗi thay đổi. Cửa sổ 8 giây do chính vé giữ
      // (`UNDO_WINDOW_MS`), nên ở đây không có bộ đếm thời gian nào.
      const ticket = createUndoTicket({
        description: label,
        undo: () => {
          result.undo();
          autosave.notifyChange();
        },
        ...(nowOption !== undefined ? { now: nowOption } : {}),
      });

      onToast?.({
        message: toastMessage,
        onUndo: () => {
          ticket.undo();
        },
        undoTicket: ticket,
      });
    },
    [autosave, canEditRules, nowOption, onToast],
  );

  /* ---------------------------------------------------------------------- */
  /* Từ cấu hình sang mô hình của view.                                      */
  /* ---------------------------------------------------------------------- */

  const resolved = useMemo(() => resolveRules(registry, config), [registry, config]);
  const supersededCodes = useMemo(() => new Set(SUPERSEDED_BUILT_IN_CODES), []);

  const rows = useMemo<readonly RuleSettingsRow[]>(() => {
    const hasModel = graph !== null;

    return resolved.map((item) => {
      const code = item.rule.code;
      // Ngưỡng chung nằm ở thẻ riêng của nó, nên hàng luật chỉ giữ ngưỡng riêng.
      const specs = thresholdSpecsFor(code).filter((spec) => !spec.isGeneral);
      const impactCount = hasModel ? impactCounts[code] ?? 0 : null;

      return {
        code,
        // `Rule.name` đã là một câu tiếng Việt viết thường — dùng thẳng.
        sentence: item.rule.name,
        description: describeRule(item, specs),
        enabled: item.enabled,
        severity: item.severity,
        thresholds: specs.map((spec) =>
          toThreshold(
            spec,
            item.thresholds[spec.key] ?? spec.defaultValue,
            thresholdErrors[errorKeyOf(code, spec.key)] ?? null,
          ),
        ),
        impactCaption: describeImpact(impactCount),
        impactCount,
        supersededBy: supersededCodes.has(code) ? SUPERSEDED_BY[code] ?? null : null,
      } satisfies RuleSettingsRow;
    });
  }, [graph, impactCounts, resolved, supersededCodes, thresholdErrors]);

  const groups = useMemo<readonly RuleSettingsGroup[]>(() => {
    const rowByCode = new Map(rows.map((row) => [row.code, row]));
    const byGroup = new Map<RuleGroup, RuleSettingsRow[]>();

    for (const item of resolved) {
      const row = rowByCode.get(item.rule.code);

      if (row === undefined) {
        continue;
      }

      const bucket = byGroup.get(item.rule.group);

      if (bucket === undefined) {
        byGroup.set(item.rule.group, [row]);
      } else {
        bucket.push(row);
      }
    }

    // Thứ tự nhóm lấy từ `RULE_GROUPS` của domain, màn không tự xếp lại.
    return RULE_GROUPS.flatMap((group) => {
      const bucket = byGroup.get(group);

      if (bucket === undefined || bucket.length === 0) {
        return [];
      }

      const enabledCount = bucket.filter((row) => row.enabled).length;

      return [
        {
          group,
          label: RULE_GROUP_LABELS[group],
          // Không bịa một câu giới thiệu cho nhóm: hai con số thật nói đủ.
          description: `${formatNumber(bucket.length)} luật, ${formatNumber(enabledCount)} đang bật.`,
          // Toggle tổng bật khi còn ít nhất một luật con bật.
          enabled: enabledCount > 0,
          rows: bucket,
        } satisfies RuleSettingsGroup,
      ];
    });
  }, [resolved, rows]);

  const generalThresholds = useMemo<readonly RuleSettingsThreshold[]>(() => {
    // Dung sai chung nằm dưới mã giả `GENERAL_THRESHOLD_CODE`, và
    // `registry.get('GENERAL')` là `null` — nó cố ý không phải một luật. Nên
    // giá trị đang áp đọc thẳng từ override của mã ấy, không tra qua
    // `resolveRules`: tra qua đó thì không luật nào mang mã `GENERAL`, mọi ô
    // rơi về `defaultValue`, và thẻ "ngưỡng chung" quên sạch thứ người dùng vừa
    // gõ ngay lần vẽ lại kế tiếp.
    const general = config.overrides[GENERAL_THRESHOLD_CODE]?.thresholds;

    return RULE_THRESHOLD_SPECS.filter((spec) => spec.isGeneral).map((spec) =>
      toThreshold(
        spec,
        general?.[spec.key] ?? spec.defaultValue,
        thresholdErrors[errorKeyOf(spec.ruleCode, spec.key)] ?? null,
      ),
    );
  }, [config, thresholdErrors]);

  /* Hậu quả đo trước: số luật sẽ đổi hiện ra TRƯỚC khi người dùng cam kết. */
  const presets = useMemo<readonly RuleSettingsPresetOption[]>(
    () =>
      RULE_PRESETS.map((preset) => ({
        kind: preset.kind,
        label: preset.label,
        caption: preset.caption,
        changedRuleCount: diffPreset(config, preset).changedRuleCount,
      })),
    [config],
  );

  const totalRuleCount = resolved.length;
  const enabledRuleCount = useMemo(
    () => resolved.filter((item) => item.enabled).length,
    [resolved],
  );

  const hasThresholdProblem = Object.keys(thresholdErrors).length > 0;
  const saveState = toSaveIndicatorState(indicator.state);

  /**
   * Bậc thang bảy trạng thái của A11, chạy đúng một lần theo thứ tự này:
   * `collapsed → forbidden → loading → error → empty → partial → ready`.
   *
   * - `collapsed` đứng trước vì nó chỉ đổi CÁCH XẾP, và một người xem trên màn
   *   hẹp vẫn phải thấy màn thu gọn chứ không phải màn "không có quyền".
   * - `empty` là **chưa có mô hình**: 25 luật vẫn hiện đủ, nhưng không luật nào
   *   nói được nó đang ảnh hưởng bao nhiêu đối tượng.
   * - `partial` là **đọc xong nhưng chưa yên**: một ô ngưỡng đang báo lỗi, hoặc
   *   lượt tự lưu còn đang chạy.
   * - `error` chỉ là lỗi ĐỌC. Một lượt tự lưu hỏng làm `saveState === 'error'`
   *   nhưng KHÔNG làm cả màn thành lỗi — cài đặt vẫn đọc và sửa được.
   */
  const status = useMemo<RuleSettingsStatus>(() => {
    if (isCompact) {
      return 'collapsed';
    }

    // Chỉ đọc KHÔNG phải `forbidden`: N21 cho mọi thành viên đọc, view vẽ dải lý do.
    if (configQuery.isLoadingError && readWireError(configQuery.error)?.status === FORBIDDEN_STATUS) {
      return 'forbidden';
    }

    if (
      configQuery.isPending ||
      spatialLoading ||
      (configQuery.isSuccess && ruleConfigProjectId !== projectId)
    ) {
      return 'loading';
    }

    // Lượt đọc lại chạy nền hỏng mà dữ liệu cũ vẫn còn: màn giữ nguyên, không thành `error`.
    if (configQuery.isLoadingError) {
      return 'error';
    }

    if (graph === null) {
      return 'empty';
    }

    if (hasThresholdProblem || saveState === 'saving' || saveState === 'pending') {
      return 'partial';
    }

    return 'ready';
  }, [
    configQuery.error,
    configQuery.isLoadingError,
    configQuery.isPending,
    configQuery.isSuccess,
    graph,
    hasThresholdProblem,
    isCompact,
    projectId,
    ruleConfigProjectId,
    saveState,
    spatialLoading,
  ]);

  const errorMessage = useMemo<string | null>(() => {
    if (!configQuery.isLoadingError) {
      return null;
    }

    return describeError(toAppError(configQuery.error)).description || LOAD_FAILURE_FALLBACK;
  }, [configQuery.error, configQuery.isLoadingError]);

  const model = useMemo<RuleSettingsViewModel>(
    () => ({
      status,
      groups,
      generalThresholds,
      presets,
      isDefault: isDefaultConfig(config),
      saveState,
      saveCaption: indicator.label,
      totalRuleCount,
      enabledRuleCount,
      disableAllWarning: enabledRuleCount === 0 ? DISABLE_ALL_WARNING : null,
      errorMessage,
      saveProblem,
      reloadConfirmOpen,
    }),
    [
      config,
      enabledRuleCount,
      errorMessage,
      generalThresholds,
      groups,
      indicator.label,
      presets,
      reloadConfirmOpen,
      saveProblem,
      saveState,
      status,
      totalRuleCount,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Hành động.                                                              */
  /* ---------------------------------------------------------------------- */

  /**
   * Tên một luật trong câu nhật ký và câu toast.
   *
   * Dùng `Rule.name` chứ không dùng mã luật: `Rule.name` đã là một câu tiếng
   * Việt, còn `WALL-THICKNESS` là định danh máy. Mã chỉ dùng làm phương án lui
   * khi sổ đăng ký không biết luật đó — lúc ấy nói ra mã vẫn hơn nói một chỗ
   * trống, và A6 cho phép chữ hoa với mã luật.
   */
  const nameOfRule = useCallback(
    (code: RuleCode): string => registry.get(code)?.name ?? code,
    [registry],
  );

  const onToggleRule = useCallback(
    (code: RuleCode, enabled: boolean): void => {
      const label = `${enabled ? 'Bật' : 'Tắt'} luật ${nameOfRule(code)}`;

      applyConfig(setRuleEnabled(config, code, enabled), label, `${label}.`);
    },
    [applyConfig, config, nameOfRule],
  );

  const onToggleGroup = useCallback(
    (group: RuleGroup, enabled: boolean): void => {
      const label = `${enabled ? 'Bật' : 'Tắt'} nhóm ${lowerFirst(RULE_GROUP_LABELS[group])}`;

      applyConfig(setGroupEnabled(config, group, enabled), label, `${label}.`);
    },
    [applyConfig, config],
  );

  const onChangeSeverity = useCallback(
    (code: RuleCode, severity: RuleSeverity): void => {
      const label = `Đổi mức của luật ${nameOfRule(code)}`;

      applyConfig(setRuleSeverity(config, code, severity), label, `${label}.`);
    },
    [applyConfig, config, nameOfRule],
  );

  /**
   * Một ô ngưỡng vừa đổi.
   *
   * Giá trị ngoài khoảng **không** được ghi vào cấu hình: nó dừng lại ở ô, và
   * câu báo lỗi của `validateThreshold` — câu đã nêu sẵn đúng khoảng hợp lệ —
   * đi vào `RuleSettingsThreshold.error`.
   */
  const changeThreshold = useCallback(
    (code: RuleCode, key: string, value: number): void => {
      const spec = specByKey.get(key);

      if (spec === undefined) {
        return;
      }

      // `value` là con số trên ô. Ô của một ngưỡng `'tile'` chạy 50..100 còn
      // domain chạy 0,5..1, nên phép soát phải nhận con số của domain — soát
      // thẳng con số của ô thì 80 rơi ngoài khoảng và một giá trị hợp lệ bị từ
      // chối.
      const outcome = validateThreshold(spec, toDomainValue(spec, value));
      const errorKey = errorKeyOf(code, key);

      if (!outcome.ok) {
        const message = outOfRangeText(spec, outcome.message);

        setThresholdErrors((current) => ({ ...current, [errorKey]: message }));

        return;
      }

      setThresholdErrors((current) => {
        if (current[errorKey] === undefined) {
          return current;
        }

        const next = { ...current };
        delete next[errorKey];

        return next;
      });

      const label = `Đổi ngưỡng ${spec.label}`;

      applyConfig(setRuleThreshold(config, code, key, outcome.value), label, `${label}.`);
    },
    [applyConfig, config, specByKey],
  );

  const onChangeThreshold = useCallback(
    (code: RuleCode, key: string, value: number): void => {
      changeThreshold(code, key, value);
    },
    [changeThreshold],
  );

  /**
   * Ngưỡng chung không mang mã luật trong chữ ký — view không cần biết ngưỡng ấy
   * thuộc luật nào. Spec thì biết, nên mã luật tra ra từ khoá.
   */
  const onChangeGeneralThreshold = useCallback(
    (key: string, value: number): void => {
      const spec = specByKey.get(key);

      if (spec === undefined) {
        return;
      }

      changeThreshold(spec.ruleCode, key, value);
    },
    [changeThreshold, specByKey],
  );

  /**
   * Áp một bộ luật sẵn.
   *
   * `diffPreset` chạy **trước** lượt ghi, để câu toast nói ra con số thật của
   * chính lượt vừa xảy ra chứ không phải một con số ước lượng. Cùng con số ấy đã
   * hiện sẵn trên nút (`RuleSettingsPresetOption.changedRuleCount`), nên người
   * dùng biết hậu quả trước khi bấm.
   */
  const onApplyPreset = useCallback(
    (kind: BuildingKind): void => {
      if (!capabilities.canApplyPreset) {
        return;
      }

      const preset: RulePreset | undefined = RULE_PRESETS.find((item) => item.kind === kind);

      if (preset === undefined) {
        return;
      }

      const diff = diffPreset(config, preset);
      const label = `Áp bộ luật ${preset.label}`;

      applyConfig(
        preset.config,
        label,
        `${label}: ${formatNumber(diff.changedRuleCount)} luật đã đổi.`,
      );
    },
    [applyConfig, capabilities.canApplyPreset, config],
  );

  const onRestoreDefaults = useCallback((): void => {
    setThresholdErrors({});
    applyConfig(resetConfig(), 'Trả bộ luật về mặc định', 'Đã trả bộ luật về mặc định.');
  }, [applyConfig]);

  return {
    model,
    capabilities,
    onToggleRule,
    onToggleGroup,
    onChangeSeverity,
    onChangeThreshold,
    onChangeGeneralThreshold,
    onApplyPreset,
    onRestoreDefaults,
    onReload,
    onConfirmReload,
    onCancelReload,
  };
}
