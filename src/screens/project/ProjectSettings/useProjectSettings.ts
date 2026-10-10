/**
 * Toàn bộ phần suy nghĩ của màn cài đặt dự án: đọc, sửa, tự lưu, và hai việc
 * nguy hiểm.
 *
 * Mục D chia đôi: file này giữ trạng thái và làm mọi phép tính; bốn thẻ trong
 * `ProjectSettings.tsx` chỉ vẽ. Mọi chuỗi người dùng đọc — "50 mm", "75%",
 * "248,60 m²", câu hậu quả của nút xoá — đã dựng xong ở đây, nên view không còn
 * gì để làm tròn hay quy đổi (bất biến A15).
 *
 * ## Ba thứ file này nối lại chứ không dựng lại
 *
 * - **R-64** — `useQuery` với khoá {@link projectSettingsQueryKey}. Không một ô
 *   trạng thái tự viết nào cho việc đang tải, cũng không cho lỗi đọc: cả hai
 *   thuộc về tầng query.
 * - **D-07** — `createAutosave` + `useSaveIndicator`. **Không** truyền
 *   `debounceMs`: 800 ms mặc định của `createAutosave` chính là con số của bất
 *   biến A7, viết lại là tạo bản sao sẽ lệch (R-71). Cũng không dùng
 *   `useAutosave` hay `ConnectedSaveIndicator` — cả hai khoá cứng vào slice
 *   `spatial` của store, thứ màn này không có.
 * - **D-05** — `createUndoTicket` cho mỗi lượt lưu thành công, cửa sổ 8 giây do
 *   chính vé giữ. Không dùng `useUndoableToast` (đọc store zustand); toast được
 *   tiêm vào qua `onToast`.
 *
 * ## Bất biến của mô hình
 *
 * Xem doc comment của {@link ProjectSettingsModel}.
 *
 * ## Hai đường ghi
 *
 * Tên, mã, địa chỉ đi #26; sáu trường còn lại đi N6 kèm `revision` (xem
 * `projectSettingsGateway.ts`). Một lượt tự lưu có thể xong một phần: phần xong vào
 * `saved`, phần hỏng giữ nháp, và engine thử lại hay dừng theo lỗi gốc mà hook ném.
 * 409/422/428 không bao giờ gửi lại y nguyên (R2); tháo màn khi còn nháp dở thì xả một
 * lượt cuối bằng cờ trong `bridgeRef` (R13).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { ApiError } from '@/api/client';
import type { SaveState } from '@/components/feedback/SaveIndicator';
import type { SelectOption } from '@/components/ui/Select';
import { millimetresPerPixel, pixels, scaleFromRatio } from '@/domain/units/scale';
import type { AutosaveState } from '@/lib/autosave/createAutosave';
import { createAutosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError, type AppError } from '@/lib/errors';
import { initialsOf } from '@/lib/format/initials';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import type { Announcer } from '@/lib/input/announcer';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import { applyInvalidation } from '@/lib/query/invalidation';
import { queryKeys } from '@/lib/query/queryKeys';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { useSaveIndicator } from '@/hooks/useSaveIndicator';
import type { ProjectRole } from '@/types/project';

import {
  DEFAULT_UNWIRED_SETTINGS,
  PROJECT_SETTINGS_LIMITS,
  type ProjectBuildingType,
  type ProjectLengthUnit,
  type ProjectSettingsGateway,
  type ProjectSettingsPart,
  type ProjectSettingsPatch,
  type ProjectSettingsSnapshot,
  type ProjectSettingsUpdateFailure,
} from './projectSettingsGateway';
import {
  isTransientSettingsError,
  partialSaveSentence,
  problemKeyOfError,
  rejectionOf,
  SETTINGS_SENTENCES,
  type SettingsProblemKey,
} from './settingsErrors';
import {
  useProjectMembers,
  type ProjectMembersActions,
  type ProjectMembersModel,
} from './useProjectMembers';

/** Tái xuất để bốn thẻ (view thuần, R-60) không phải nhập thẳng từ tầng dữ liệu. */
export { PROJECT_SETTINGS_LIMITS };

/* -------------------------------------------------------------------------- */
/* Khoá query.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Khoá của lượt đọc cài đặt.
 *
 * Nối thêm một nhánh vào khoá chi tiết dự án có sẵn thay vì thêm một nhánh mới
 * vào `queryKeys` (`src/lib/query` nằm ngoài ba nơi R-68 cho phép sửa). Nhờ nằm
 * dưới `project.detail(id)`, một lần vô hiệu hoá khoá cha kéo theo cả khoá này.
 */
export const projectSettingsQueryKey = (projectId: string) =>
  [...queryKeys.project.detail(projectId), 'settings'] as const;

/* -------------------------------------------------------------------------- */
/* Kiểu của mô hình.                                                           */
/* -------------------------------------------------------------------------- */

export type ProjectSettingsTabId = 'general' | 'units' | 'members' | 'danger';

export type ProjectSettingsDangerAction = 'deleteAllFloors' | 'deleteProject';

export interface ProjectSettingsTabModel {
  readonly id: ProjectSettingsTabId;
  readonly label: string;
  /** Số ô đang có lời phàn nàn trong thẻ này, để dải thẻ nói ra chỗ cần quay lại. */
  readonly problemCount: number;
}

export interface ProjectSettingsMemberRow {
  readonly id: string;
  readonly name: string;
  readonly roleLabel: string;
  readonly initials: string;
  /** Nhãn của nút gỡ, có tên người để trình đọc màn hình phân biệt các dòng. */
  readonly removeLabel: string;
}

export interface ProjectSettingsProblems {
  readonly name: string | null;
  readonly code: string | null;
  readonly address: string | null;
  readonly notes: string | null;
  readonly snapToleranceMm: string | null;
  readonly confidenceThreshold: string | null;
  readonly scaleMmPerPx: string | null;
}

/**
 * Mọi thứ view vẽ, đã phẳng và đã thành chuỗi.
 *
 * **Bất biến, và bậc thang quyết định.** Điều (11) chạy trước: `state` lấy
 * giá trị đầu tiên khớp trong dãy
 * `loading → error → collapsed → forbidden → empty → partial → success`.
 * Mười điều còn lại đọc *ở bậc mà chúng thắng* — hai lớp phủ `collapsed` và
 * `forbidden` không bao giờ làm dữ liệu biến mất, chúng chỉ đổi cách xếp và
 * quyền sửa; nên khi chưa có dữ liệu (đang tải, tải hỏng) chúng đứng sau
 * (BUG-072).
 *
 * 1. `errorMessage !== null` ⟺ `state === 'error'`. Đây là lỗi ĐỌC, và
 *    `errorMessage` được đặt sau khi bậc thang chạy xong nên hai vế khớp đúng.
 * 2. `state === 'loading'` ⇒ mọi ô dữ liệu mang mặc định rỗng, và view vẽ
 *    khung xương thay cho biểu mẫu.
 * 3. `canEdit === false` ⟺ `isReadOnly === true`, và khi màn đã tải xong, không
 *    thu gọn thì cả hai ⟺ `state === 'forbidden'`. Dữ liệu vẫn hiện đầy đủ; chỉ mất quyền
 *    sửa. (Người xem trên màn hẹp rơi vào `collapsed` theo điều 11, `canEdit`
 *    vẫn `false`.)
 * 4. `state === 'collapsed'` không đổi dữ liệu, chỉ đổi cách xếp: dải thẻ thành
 *    một ô chọn.
 * 5. `state === 'empty'` ⟺ `floorCount === 0`, đọc ở bậc của nó.
 * 6. `state === 'partial'` ⟺ (`saveState === 'saving'` hoặc `'pending'`) HOẶC
 *    có ít nhất một trường `problems` khác `null`. Hai nhánh, không phải một:
 *    đặc tả gốc gọi "một phần" là đang lưu, còn một biểu mẫu có ô sai cũng là
 *    một phần theo đúng nghĩa của A11.
 * 7. `saveState` là trục riêng. Một lượt tự lưu hỏng làm `saveState === 'error'`
 *    nhưng KHÔNG làm `state === 'error'` — màn vẫn đọc được, chỉ là chưa lưu
 *    được.
 * 8. `conflictMessage !== null` chỉ khi lần lưu gần nhất trả 409. Hành động duy
 *    nhất khi ấy là `reloadSettings`.
 * 9. `pendingDanger === null` ⟺ bốn trường `dangerDialog*` đều `null` và
 *    `isDangerRunning === false`.
 * 10. `dangerConfirmationExpected !== null` chỉ khi
 *     `pendingDanger === 'deleteProject'`, và nó bằng đúng `name` đã lưu.
 * 11. Bậc thang ở trên.
 */
export interface ProjectSettingsModel extends ProjectMembersModel {
  readonly state: SevenState;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly isReadOnly: boolean;
  readonly errorMessage: string | null;
  /** Lỗi đọc là 404: thử lại vô ích, lối ra là danh sách dự án (BUG-078). */
  readonly isProjectMissing: boolean;
  /** Lỗi đọc thử lại được (mạng, hết giờ, 5xx…) — chỉ khi ấy mới có nút "Thử lại". */
  readonly canRetryLoad: boolean;
  readonly saveState: SaveState;
  /** `null` khi màn tự ép `pending` vì còn lỗi nhập — viên chỉ báo dùng câu chờ của nó. */
  readonly saveLabel: string | null;
  readonly conflictMessage: string | null;
  /** Câu nói phần nào đã lưu, phần nào chưa; `null` khi không có phần hỏng. */
  readonly saveFailureMessage: string | null;
  /** Hộp thoại A9 trước khi tải lại bỏ bản nháp chưa lưu. */
  readonly isReloadDialogOpen: boolean;
  readonly activeTab: ProjectSettingsTabId;
  readonly tabs: readonly ProjectSettingsTabModel[];
  readonly name: string;
  readonly code: string;
  readonly address: string;
  readonly buildingType: string;
  readonly buildingTypeOptions: readonly SelectOption[];
  readonly notes: string;
  readonly notesCountLabel: string;
  readonly problems: ProjectSettingsProblems;
  readonly lengthUnit: string;
  readonly lengthUnitOptions: readonly SelectOption[];
  readonly areaUnitLabel: string;
  readonly snapToleranceMm: number | null;
  readonly snapToleranceLabel: string;
  readonly snapToleranceMinMm: number;
  readonly snapToleranceMaxMm: number;
  readonly confidenceThreshold: number;
  readonly confidenceThresholdLabel: string;
  readonly scaleMmPerPx: number | null;
  readonly scaleLabel: string;
  readonly scalePreviewLabel: string;
  readonly members: readonly ProjectSettingsMemberRow[];
  readonly memberCountLabel: string;
  readonly floorCount: number;
  readonly deleteAllFloorsLabel: string;
  readonly deleteProjectLabel: string;
  readonly pendingDanger: ProjectSettingsDangerAction | null;
  readonly dangerDialogTitle: string | null;
  readonly dangerDialogMessage: string | null;
  readonly dangerConfirmLabel: string | null;
  readonly dangerConfirmationExpected: string | null;
  readonly dangerConfirmationText: string;
  readonly canConfirmDanger: boolean;
  readonly isDangerRunning: boolean;
}

export interface ProjectSettingsActions extends ProjectMembersActions {
  readonly setActiveTab: (tab: ProjectSettingsTabId) => void;
  readonly setName: (value: string) => void;
  readonly setCode: (value: string) => void;
  readonly setAddress: (value: string) => void;
  readonly setBuildingType: (value: string) => void;
  readonly setNotes: (value: string) => void;
  readonly setLengthUnit: (value: string) => void;
  readonly setSnapToleranceMm: (value: number | undefined) => void;
  readonly setConfidenceThreshold: (value: number) => void;
  readonly setScaleMmPerPx: (value: number | undefined) => void;
  readonly saveNow: () => void;
  readonly retryLoad: () => void;
  /** Về danh sách dự án khi dự án không tồn tại; `null` khi nơi gọi không nối điều hướng. */
  readonly backToProjects: (() => void) | null;
  readonly reloadSettings: () => void;
  readonly confirmReload: () => void;
  readonly cancelReload: () => void;
  readonly requestDeleteAllFloors: () => void;
  readonly requestDeleteProject: () => void;
  readonly setDangerConfirmationText: (value: string) => void;
  readonly confirmDanger: () => void;
  readonly cancelDanger: () => void;
}

/** Mọi prop view nhận — mô hình cộng hành động, đã gộp sẵn (mục D). */
export interface ProjectSettingsViewProps extends ProjectSettingsModel, ProjectSettingsActions {}

/** Câu báo xoá dự án xong. */
export const PROJECT_DELETED_NOTICE = 'Đã xoá dự án.';

export interface UseProjectSettingsOptions {
  readonly gateway: ProjectSettingsGateway;
  readonly projectId: string;
  readonly roles?: readonly ProjectRole[];
  /** Đồng hồ tiêm được (R-29): dùng cho cả tự lưu lẫn chỉ báo lưu và vé hoàn tác. */
  readonly now?: () => number;
  readonly isOnline?: () => boolean;
  /** Ép cách xếp thu gọn — cho story hoặc test muốn một câu trả lời cố định. */
  readonly forceCollapsed?: boolean;
  readonly announcer?: Announcer;
  /** Toast hoàn tác của A8. Tiêm vào; `Toast.Provider` do nơi gọi dựng. */
  readonly onToast?: (toast: { readonly message: string; readonly onUndo?: () => void }) => void;
  /**
   * Gọi sau khi dự án đã bị xoá, để nơi gọi điều hướng đi nơi khác — và mang theo
   * câu báo kết quả. Có hàm này thì hook KHÔNG toast tại chỗ: nơi gọi sắp rời màn,
   * và `Toast.Provider` của màn rời theo, nên câu báo phải đi tới chỗ còn sống sau
   * lượt điều hướng (B-V3-05).
   */
  readonly onProjectDeleted?: (notice: string) => void;
  /** Mã người dùng đang đăng nhập, để nhận ra việc tự gỡ mình khỏi dự án. */
  readonly currentUserId?: string;
  /** Gọi sau khi chính người dùng bị gỡ khỏi dự án; nơi gọi điều hướng đi. */
  readonly onSelfRemoved?: () => void;
  /** Lối về danh sách dự án khi lượt đọc trả 404; nơi gọi điều hướng đi. */
  readonly onBackToProjects?: () => void;
}

/** Lỗi đọc giữ nguyên `AppError` để màn biết đó là 404 hay lỗi thử lại được (BUG-078). */
class SettingsLoadError extends Error {
  constructor(readonly appError: AppError) {
    super(describeError(appError).description);
  }
}

/* -------------------------------------------------------------------------- */
/* Bản nháp.                                                                   */
/* -------------------------------------------------------------------------- */

interface ProjectSettingsDraft {
  readonly name: string;
  readonly code: string;
  readonly address: string;
  readonly buildingType: ProjectBuildingType;
  readonly notes: string;
  readonly lengthUnit: ProjectLengthUnit;
  /** `null` khi ô đang trống — khác với 0, thứ là một dung sai hợp lệ về mặt kiểu. */
  readonly snapToleranceMm: number | null;
  readonly confidenceThreshold: number;
  readonly scaleMmPerPx: number | null;
}

type MutablePatch = { -readonly [K in keyof ProjectSettingsPatch]: ProjectSettingsPatch[K] };

function toDraft(snapshot: ProjectSettingsSnapshot): ProjectSettingsDraft {
  return {
    name: snapshot.name,
    code: snapshot.code,
    address: snapshot.address,
    buildingType: snapshot.buildingType,
    notes: snapshot.notes,
    lengthUnit: snapshot.lengthUnit,
    snapToleranceMm: snapshot.snapToleranceMm,
    confidenceThreshold: snapshot.confidenceThreshold,
    scaleMmPerPx: snapshot.scaleMmPerPx,
  };
}

const EMPTY_DRAFT: ProjectSettingsDraft = {
  name: '',
  code: '',
  address: '',
  buildingType: DEFAULT_UNWIRED_SETTINGS.buildingType,
  notes: '',
  lengthUnit: DEFAULT_UNWIRED_SETTINGS.lengthUnit,
  snapToleranceMm: null,
  confidenceThreshold: DEFAULT_UNWIRED_SETTINGS.confidenceThreshold,
  scaleMmPerPx: null,
};

/** Chỉ những trường thật sự đổi; `null` khi không có gì để gửi. */
function diffDraft(saved: ProjectSettingsDraft, draft: ProjectSettingsDraft): ProjectSettingsPatch | null {
  const patch: MutablePatch = {};

  if (draft.name !== saved.name) patch.name = draft.name;
  if (draft.code !== saved.code) patch.code = draft.code;
  if (draft.address !== saved.address) patch.address = draft.address;
  if (draft.buildingType !== saved.buildingType) patch.buildingType = draft.buildingType;
  if (draft.notes !== saved.notes) patch.notes = draft.notes;
  if (draft.lengthUnit !== saved.lengthUnit) patch.lengthUnit = draft.lengthUnit;
  if (draft.snapToleranceMm !== null && draft.snapToleranceMm !== saved.snapToleranceMm) {
    patch.snapToleranceMm = draft.snapToleranceMm;
  }
  if (draft.confidenceThreshold !== saved.confidenceThreshold) {
    patch.confidenceThreshold = draft.confidenceThreshold;
  }
  if (draft.scaleMmPerPx !== null && draft.scaleMmPerPx !== saved.scaleMmPerPx) {
    patch.scaleMmPerPx = draft.scaleMmPerPx;
  }

  return Object.keys(patch).length === 0 ? null : patch;
}

/* -------------------------------------------------------------------------- */
/* Hai phần của một lượt lưu: #26 (chung) và N6 (đơn vị đo).                   */
/* -------------------------------------------------------------------------- */

type DraftKey = keyof ProjectSettingsDraft;

const KEYS_BY_PART: Readonly<Record<ProjectSettingsPart, readonly DraftKey[]>> = {
  general: ['name', 'code', 'address'],
  units: ['buildingType', 'notes', 'lengthUnit', 'snapToleranceMm', 'confidenceThreshold', 'scaleMmPerPx'],
};

const PARTS: readonly ProjectSettingsPart[] = ['general', 'units'];

/** Dấu vân tay của một phần nháp: đổi khi và chỉ khi người dùng sửa phần đó. */
function partKey(draft: ProjectSettingsDraft, part: ProjectSettingsPart): string {
  return JSON.stringify(KEYS_BY_PART[part].map((key) => draft[key]));
}

function partsOf(patch: ProjectSettingsPatch): readonly ProjectSettingsPart[] {
  return PARTS.filter((part) => KEYS_BY_PART[part].some((key) => patch[key as keyof ProjectSettingsPatch] !== undefined));
}

function stripPart(patch: ProjectSettingsPatch, part: ProjectSettingsPart): ProjectSettingsPatch {
  const next: MutablePatch = { ...patch };

  for (const key of KEYS_BY_PART[part]) {
    delete next[key as keyof MutablePatch];
  }

  return next;
}

/** Máy chủ đã từ chối (409/422/428) phần này với đúng bản nháp có dấu vân tay `key`. */
interface Rejection {
  readonly key: string;
  readonly error: ApiError;
}

type Rejections = Record<ProjectSettingsPart, Rejection | null>;

const noRejections = (): Rejections => ({ general: null, units: null });

/** Lỗi tạm đứng trước, vì engine hẹn lại; hết lỗi tạm mới tới lời từ chối đang giữ. */
function pickErrorToThrow(
  failures: readonly ProjectSettingsUpdateFailure[],
  held: readonly ApiError[],
): ApiError | null {
  const transient = failures.find((failure) => isTransientSettingsError(failure.error));

  return transient?.error ?? held[0] ?? failures[0]?.error ?? null;
}

/** Lời máy chủ chê một ô: chỉ bảy ô của `ProjectSettingsProblems` có chỗ hiện. */
type ServerProblems = Partial<Record<SettingsProblemKey, string>>;

/* -------------------------------------------------------------------------- */
/* Lời phàn nàn của biểu mẫu — vị ngữ thuần, khuôn `localNameProblemFor`.       */
/* -------------------------------------------------------------------------- */

const LIMITS = PROJECT_SETTINGS_LIMITS;

function nameProblemFor(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Chưa nhập tên dự án.';
  if (trimmed.length < LIMITS.nameMinLength) {
    return `Tên dự án cần ít nhất ${formatNumber(LIMITS.nameMinLength, { grouping: false })} ký tự.`;
  }
  if (trimmed.length > LIMITS.nameMaxLength) {
    return `Tên dự án không quá ${formatNumber(LIMITS.nameMaxLength, { grouping: false })} ký tự.`;
  }
  return null;
}

/** #26 không nhận chuỗi rỗng, nên một giá trị đã lưu chưa xoá trống được. */
function codeProblemFor(code: string, savedCode: string): string | null {
  if (code.length === 0 && savedCode.length > 0) return SETTINGS_SENTENCES.emptyBlocked;
  if (code.length > LIMITS.codeMaxLength) {
    return `Mã dự án không quá ${formatNumber(LIMITS.codeMaxLength, { grouping: false })} ký tự.`;
  }
  return null;
}

function addressProblemFor(address: string, savedAddress: string): string | null {
  if (address.length === 0 && savedAddress.length > 0) return SETTINGS_SENTENCES.emptyBlocked;
  if (address.length > LIMITS.addressMaxLength) {
    return `Địa chỉ không quá ${formatNumber(LIMITS.addressMaxLength, { grouping: false })} ký tự.`;
  }
  return null;
}

function notesProblemFor(notes: string): string | null {
  if (notes.length > LIMITS.notesMaxLength) {
    return `Ghi chú không quá ${formatNumber(LIMITS.notesMaxLength, { grouping: false })} ký tự.`;
  }
  return null;
}

function snapProblemFor(value: number | null): string | null {
  if (value === null) return 'Chưa nhập dung sai bắt điểm.';
  if (!Number.isInteger(value)) return SETTINGS_SENTENCES.snapNotInteger;
  if (value <LIMITS.snapToleranceMinMm || value > LIMITS.snapToleranceMaxMm) {
    return (
      `Dung sai bắt điểm áp dụng từ ${formatLength(LIMITS.snapToleranceMinMm, { unit: 'mm' })} ` +
      `đến ${formatLength(LIMITS.snapToleranceMaxMm, { unit: 'mm' })}.`
    );
  }
  return null;
}

function confidenceProblemFor(value: number): string | null {
  if (value < LIMITS.confidenceMin || value > LIMITS.confidenceMax) {
    return (
      `Ngưỡng tin cậy nằm trong khoảng ${formatPercent(LIMITS.confidenceMin, { fractionDigits: 0 })} ` +
      `đến ${formatPercent(LIMITS.confidenceMax, { fractionDigits: 0 })}.`
    );
  }
  return null;
}

function scaleProblemFor(value: number | null): string | null {
  if (value === null) return 'Chưa nhập tỉ lệ bản vẽ.';
  if (value < LIMITS.scaleMinMmPerPx || value > LIMITS.scaleMaxMmPerPx) {
    return (
      `Tỉ lệ bản vẽ áp dụng từ ${formatNumber(LIMITS.scaleMinMmPerPx, { maxFractionDigits: 2 })} ` +
      `đến ${formatNumber(LIMITS.scaleMaxMmPerPx)} milimét trên mỗi điểm ảnh.`
    );
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Chuỗi hiển thị.                                                             */
/* -------------------------------------------------------------------------- */

const BUILDING_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'residential', label: 'Nhà ở' },
  { value: 'commercial', label: 'Thương mại' },
  { value: 'industrial', label: 'Công nghiệp' },
  { value: 'mixed', label: 'Hỗn hợp' },
  { value: 'other', label: 'Khác' },
];

const LENGTH_UNIT_OPTIONS: readonly SelectOption[] = [
  { value: 'mm', label: 'Milimét (mm)' },
  { value: 'm', label: 'Mét (m)' },
];

const TAB_LABELS: Readonly<Record<ProjectSettingsTabId, string>> = {
  general: 'Chung',
  units: 'Đơn vị đo',
  members: 'Thành viên',
  danger: 'Vùng nguy hiểm',
};

const ROLE_LABELS: Readonly<Record<ProjectRole, string>> = {
  admin: 'Quản trị',
  engineer: 'Kỹ sư',
  viewer: 'Người xem',
};

const DANGER_TITLES: Readonly<Record<ProjectSettingsDangerAction, string>> = {
  deleteAllFloors: 'Xoá mọi tầng của dự án?',
  deleteProject: 'Xoá dự án này?',
};

const DANGER_MESSAGES: Readonly<Record<ProjectSettingsDangerAction, string>> = {
  deleteAllFloors:
    'Mọi tầng cùng bản vẽ và mô hình của chúng sẽ bị xoá vĩnh viễn. Không hoàn tác được.',
  deleteProject:
    'Dự án cùng toàn bộ tầng, bản vẽ và mô hình bên trong sẽ bị xoá vĩnh viễn. Không hoàn tác được.',
};

const DANGER_CONFIRM_LABELS: Readonly<Record<ProjectSettingsDangerAction, string>> = {
  deleteAllFloors: 'Xoá mọi tầng',
  deleteProject: 'Xoá dự án',
};

function scalePreviewLabelFor(scaleMmPerPx: number | null): string {
  if (scaleMmPerPx === null || scaleMmPerPx <= 0) {
    return 'Chưa nói được quãng thật vì tỉ lệ chưa hợp lệ.';
  }

  // `scaleFromRatio` ném lỗi với tỉ lệ không dương, nên nhánh trên là chặn chứ
  // không phải trang trí.
  const scale = scaleFromRatio(millimetresPerPixel(scaleMmPerPx));
  const preview = scale.pixelsToMillimetres(pixels(LIMITS.scalePreviewPx));

  return (
    `${formatNumber(LIMITS.scalePreviewPx, { grouping: false })} điểm ảnh ứng với ` +
    `${formatLength(preview)} ngoài thực tế.`
  );
}

/**
 * Trạng thái tự lưu, dịch sang bốn nhãn mà `SaveIndicator` biết vẽ.
 *
 * `offline` gộp vào `'error'` vì `SaveState` không có nhánh ngoại tuyến, và với
 * người dùng hai thứ nói cùng một điều: thay đổi CHƯA nằm trên máy chủ. Lý do
 * cụ thể không mất đi — `useSaveIndicator` trả về `saveLabel` riêng cho ngoại
 * tuyến ("Ngoại tuyến — sẽ lưu khi có mạng"), và view vẽ nhãn đó cạnh biểu tượng.
 */
export function toSaveState(autosaveState: AutosaveState): SaveState {
  switch (autosaveState) {
    case 'dirty':
      return 'pending';
    case 'saving':
      return 'saving';
    case 'saved':
      return 'saved';
    case 'failed':
      return 'error';
    case 'offline':
      return 'error';
  }
}

/* -------------------------------------------------------------------------- */
/* Cách xếp thu gọn.                                                           */
/* -------------------------------------------------------------------------- */

const NARROW_VIEWPORT_QUERY = '(max-width: 1023px)';

/** `< 1024px` — cùng mốc `ProjectDashboard` và `CreateProjectModal` đang dùng. */
function useNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(NARROW_VIEWPORT_QUERY).matches : false,
  );

  useEffect(() => {
    const media = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(media.matches);
    const listener = (event: MediaQueryListEvent): void => setIsNarrow(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  return isNarrow;
}

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/** Vai mặc định khi nơi gọi không nói gì; một mảng rỗng truyền vào vẫn là "không có quyền". */
const DEFAULT_ROLES: readonly ProjectRole[] = ['engineer'];

const SAVED_TOAST_MESSAGE = 'Đã lưu cài đặt dự án.';
const UNDO_DESCRIPTION = 'Hoàn tác thay đổi cài đặt dự án';
const LOAD_FAILURE_FALLBACK = 'Không tải được cài đặt dự án.';

/**
 * Bản chờ của lượt xả khi màn bị tháo (R13).
 *
 * Chụp đồng bộ lúc tháo, kèm `projectId`, `gateway` và `base` của chính lượt gắn
 * màn đó — bản nháp của màn sau (hay của người dùng khác) không được lẫn vào.
 * `pending` còn giá trị tới khi một lượt gửi của nó thành công hoặc hỏng vĩnh viễn.
 */
interface FlushState {
  readonly projectId: string;
  readonly gateway: ProjectSettingsGateway;
  base: ProjectSettingsSnapshot | null;
  pending: ProjectSettingsPatch | null;
}

/**
 * Những gì lượt tự lưu cần đọc lúc nó chạy, luôn là bản mới nhất (khuôn "ref mới nhất").
 *
 * \`flush\` là cờ dispose của R13: khác \`null\` nghĩa là màn đã tháo, và engine chỉ
 * còn gửi \`flush.pending\` bằng \`flush.gateway\`. Cờ nằm ở đây chứ không trong
 * \`createAutosave\` (F-01a, không sửa).
 */
interface AutosaveBridge {
  readonly getChanges: () => ProjectSettingsPatch | undefined;
  readonly save: (changes: ProjectSettingsPatch) => Promise<void>;
  readonly gateway: ProjectSettingsGateway;
  flush: FlushState | null;
}

type MutableDraft = { -readonly [K in DraftKey]: ProjectSettingsDraft[K] };

function copyDraftKey<K extends DraftKey>(to: MutableDraft, from: ProjectSettingsDraft, key: K): void {
  to[key] = from[key];
}

/** Gửi nốt bản chờ sau khi màn đã tháo. Không đụng state React nào. */
async function sendFlush(
  flush: FlushState,
  changes: ProjectSettingsPatch,
  queryClient: QueryClient,
): Promise<void> {
  const attempted = partsOf(changes);

  if (flush.base === null || attempted.length === 0) {
    flush.pending = null;
    return;
  }

  const outcome = await flush.gateway.update({
    projectId: flush.projectId,
    patch: changes,
    base: flush.base,
  });
  const failedParts = new Set(outcome.failures.map((failure) => failure.part));
  const succeeded = attempted.filter((part) => !failedParts.has(part));

  flush.base = outcome.snapshot;

  if (succeeded.includes('general')) {
    applyInvalidation(queryClient, 'renameProject', { projectId: flush.projectId });
  }

  const [firstFailure] = outcome.failures;

  if (firstFailure === undefined) {
    flush.pending = null;
    return;
  }

  const transient = outcome.failures.find((failure) => isTransientSettingsError(failure.error));

  if (transient === undefined) {
    // Hỏng vĩnh viễn: bỏ bản chờ, R2 xếp `failed` và không gửi lại.
    flush.pending = null;
    throw firstFailure.error;
  }

  flush.pending = succeeded.reduce((patch, part) => stripPart(patch, part), changes);
  throw transient.error;
}

export function useProjectSettings(options: UseProjectSettingsOptions): ProjectSettingsViewProps {
  const { gateway, projectId } = options;
  const roles = options.roles ?? DEFAULT_ROLES;
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ProjectSettingsTabId>('general');
  const [draft, setDraft] = useState<ProjectSettingsDraft | null>(null);
  const [saved, setSaved] = useState<ProjectSettingsDraft | null>(null);
  const [syncedKey, setSyncedKey] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [isReloadDialogOpen, setReloadDialogOpen] = useState(false);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [saveFailureMessage, setSaveFailureMessage] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<ServerProblems>({});
  const [pendingDanger, setPendingDanger] = useState<ProjectSettingsDangerAction | null>(null);
  const [dangerConfirmationText, setDangerConfirmationText] = useState('');
  const [dangerFailure, setDangerFailure] = useState<string | null>(null);
  const [isDangerRunning, setDangerRunning] = useState(false);

  // Bản sao đồng bộ của state mà logic lưu đọc: một lượt chạy tiếp ngay sau lượt
  // trước (engine xếp hàng) có thể xảy ra trước khi React kịp vẽ lại.
  const draftRef = useRef<ProjectSettingsDraft | null>(null);
  const savedRef = useRef<ProjectSettingsDraft | null>(null);
  const baseRef = useRef<ProjectSettingsSnapshot | null>(null);
  const rejectionsRef = useRef<Rejections>(noRejections());

  const commitDraft = (next: ProjectSettingsDraft | null): void => {
    draftRef.current = next;
    setDraft(next);
  };

  const commitSaved = (next: ProjectSettingsDraft | null): void => {
    savedRef.current = next;
    setSaved(next);
  };

  const detectedNarrow = useNarrowViewport();
  const isCollapsed = options.forceCollapsed ?? detectedNarrow;

  const canEdit = can('edit', 'project.settings', { roles });
  const canDelete = canEdit && roles.includes('admin');

  const settingsQuery = useQuery({
    queryKey: projectSettingsQueryKey(projectId),
    queryFn: async (): Promise<ProjectSettingsSnapshot> => {
      const result = await gateway.read({ projectId });

      if (!result.ok) {
        throw new SettingsLoadError(toAppError(result.error));
      }

      return result.data;
    },
  });

  const snapshot = settingsQuery.data ?? null;

  // Nạp bản nháp từ ảnh chụp NGAY TRONG lúc render, không qua effect (R-27):
  // effect đẩy dữ liệu sang lượt render sau, tức có một khung hình biểu mẫu
  // trống trong khi dữ liệu đã về. Khoá đồng bộ gồm mã dự án và số lần người
  // dùng chủ động nạp lại, nên một lượt refetch do vô hiệu hoá bộ đệm KHÔNG
  // xoá những gì đang gõ dở.
  const baselineKey = `${projectId}#${String(reloadToken)}`;

  if (snapshot !== null && syncedKey !== baselineKey) {
    const initial = toDraft(snapshot);
    setSyncedKey(baselineKey);
    commitDraft(initial);
    commitSaved(initial);
    baseRef.current = snapshot;
    rejectionsRef.current = noRejections();
    setConflictMessage(null);
    setSaveFailureMessage(null);
    setServerProblems({});
  }

  const current = draft ?? EMPTY_DRAFT;
  const hasData = draft !== null;

  // Lời phàn nàn cục bộ chặn tự lưu; lời của máy chủ chỉ hiện, không chặn: chặn thì
  // người dùng sửa phần khác cũng không lưu được.
  const localProblems = useMemo<ProjectSettingsProblems>(
    () =>
      hasData
        ? {
            name: nameProblemFor(current.name),
            code: codeProblemFor(current.code, saved?.code ?? ''),
            address: addressProblemFor(current.address, saved?.address ?? ''),
            notes: notesProblemFor(current.notes),
            snapToleranceMm: snapProblemFor(current.snapToleranceMm),
            confidenceThreshold: confidenceProblemFor(current.confidenceThreshold),
            scaleMmPerPx: scaleProblemFor(current.scaleMmPerPx),
          }
        : {
            name: null,
            code: null,
            address: null,
            notes: null,
            snapToleranceMm: null,
            confidenceThreshold: null,
            scaleMmPerPx: null,
          },
    [hasData, current, saved],
  );

  const problems: ProjectSettingsProblems = {
    name: localProblems.name ?? serverProblems.name ?? null,
    code: localProblems.code ?? serverProblems.code ?? null,
    address: localProblems.address ?? serverProblems.address ?? null,
    notes: localProblems.notes ?? serverProblems.notes ?? null,
    snapToleranceMm: localProblems.snapToleranceMm ?? serverProblems.snapToleranceMm ?? null,
    confidenceThreshold: localProblems.confidenceThreshold ?? serverProblems.confidenceThreshold ?? null,
    scaleMmPerPx: localProblems.scaleMmPerPx ?? serverProblems.scaleMmPerPx ?? null,
  };

  const countProblems = (list: readonly (string | null)[]): number =>
    list.filter((problem) => problem !== null).length;

  const generalProblemCount = countProblems([problems.name, problems.code, problems.address, problems.notes]);
  const unitsProblemCount = countProblems([
    problems.snapToleranceMm,
    problems.confidenceThreshold,
    problems.scaleMmPerPx,
  ]);
  const hasProblem = generalProblemCount + unitsProblemCount > 0;
  const hasLocalProblem = countProblems(Object.values(localProblems)) > 0;

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (D-07) và vé hoàn tác (D-05).                                    */
  /* ---------------------------------------------------------------------- */

  const invalidateProjectQueries = (operation: 'deleteProject' | 'renameProject'): void => {
    applyInvalidation(queryClient, operation, { projectId });
  };

  // Khuôn "ref mới nhất" (`src/hooks/useShortcut.ts:180-182`): `createAutosave`
  // được dựng đúng một lần, nhưng thứ nó gọi 800 ms sau phải là bản nháp mới
  // nhất chứ không phải bản của lượt render đã tạo ra nó.
  const bridgeRef = useRef<AutosaveBridge>({
    getChanges: () => undefined,
    save: async () => undefined,
    gateway,
    flush: null,
  });

  const [autosave] = useState(() =>
    createAutosave<ProjectSettingsPatch>({
      getChanges: () => {
        const bridge = bridgeRef.current;

        return bridge.flush === null ? bridge.getChanges() : (bridge.flush.pending ?? undefined);
      },
      save: (changes) => {
        const bridge = bridgeRef.current;

        return bridge.flush === null
          ? bridge.save(changes)
          : sendFlush(bridge.flush, changes, queryClient);
      },
      ...(options.now !== undefined ? { now: options.now } : {}),
      ...(options.isOnline !== undefined ? { isOnline: options.isOnline } : {}),
    }),
  );

  const indicator = useSaveIndicator(autosave, {
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.announcer !== undefined ? { announcer: options.announcer } : {}),
  });

  /** Phần mà máy chủ đã từ chối đúng bản nháp hiện tại; sửa phần đó thì lời từ chối hết hiệu lực. */
  const activeRejection = (part: ProjectSettingsPart, now: ProjectSettingsDraft): Rejection | null => {
    const rejection = rejectionsRef.current[part];

    if (rejection === null) return null;
    if (rejection.key === partKey(now, part)) return rejection;

    rejectionsRef.current[part] = null;
    return null;
  };

  const getChanges = (): ProjectSettingsPatch | undefined => {
    const nowDraft = draftRef.current;
    const nowSaved = savedRef.current;

    if (nowDraft === null || nowSaved === null || hasLocalProblem) {
      return undefined;
    }

    let patch = diffDraft(nowSaved, nowDraft);

    if (patch === null) {
      return undefined;
    }

    // R2: phần đã bị 409/422 không gửi lại tới khi nháp của phần đó đổi. Còn lại
    // `{}` thì vẫn trả về: lượt `save` sẽ ném lại lỗi đang giữ, để trạng thái là `failed`.
    for (const part of PARTS) {
      if (activeRejection(part, nowDraft) !== null) {
        patch = stripPart(patch, part);
      }
    }

    return patch;
  };

  const adoptSavedParts = (
    parts: readonly ProjectSettingsPart[],
    sent: ProjectSettingsPatch,
    server: ProjectSettingsDraft,
  ): void => {
    const nextSaved: MutableDraft = { ...(savedRef.current ?? server) };
    const nextDraft: MutableDraft = { ...(draftRef.current ?? server) };

    for (const key of parts.flatMap((part) => KEYS_BY_PART[part])) {
      const sentValue = sent[key as keyof ProjectSettingsPatch];

      if (sentValue === undefined) continue;

      // Máy chủ làm tròn (N6): lấy số của nó cho `saved`; nháp chưa đổi từ lúc gửi
      // thì chép theo để không sinh một diff ma và một lượt lưu thứ hai.
      copyDraftKey(nextSaved, server, key);

      if (nextDraft[key] === sentValue) {
        copyDraftKey(nextDraft, server, key);
      }
    }

    commitSaved(nextSaved);
    commitDraft(nextDraft);
  };

  const recordRejections = (
    failures: readonly ProjectSettingsUpdateFailure[],
    sentDraft: ProjectSettingsDraft | null,
  ): void => {
    for (const failure of failures) {
      const rejection = rejectionOf(failure.error);

      if (rejection === null) continue;

      rejectionsRef.current[failure.part] = {
        key: sentDraft === null ? '' : partKey(sentDraft, failure.part),
        error: failure.error,
      };

      if (rejection === 'conflict') {
        setConflictMessage(SETTINGS_SENTENCES.conflict);
        continue;
      }

      const problemKey = problemKeyOfError(failure.error);

      if (rejection === 'validation' && problemKey !== null) {
        setServerProblems((previous) => ({ ...previous, [problemKey]: SETTINGS_SENTENCES.fieldRejected }));
      }
    }
  };

  const save = async (changes: ProjectSettingsPatch): Promise<void> => {
    const previous = savedRef.current;
    const sentDraft = draftRef.current;
    const base = baseRef.current;
    const attempted = partsOf(changes);
    let failures: readonly ProjectSettingsUpdateFailure[] = [];

    if (attempted.length > 0 && base !== null) {
      const outcome = await gateway.update({ projectId, patch: changes, base });
      const failedParts = new Set(outcome.failures.map((failure) => failure.part));
      const succeeded = attempted.filter((part) => !failedParts.has(part));

      failures = outcome.failures;
      baseRef.current = outcome.snapshot;

      // Màn đã tháo trong lúc gửi: bản chờ của R13 lo phần còn lại, không đụng UI nữa.
      if (bridgeRef.current.flush !== null) {
        const [firstFailure] = failures;

        if (firstFailure !== undefined) {
          const flush = bridgeRef.current.flush;
          const rejected = failures.filter((failure) => rejectionOf(failure.error) !== null);

          // Phần bị từ chối (409/422) không được xả lại (R2).
          if (flush.pending !== null) {
            const rest = rejected.reduce((patch, failure) => stripPart(patch, failure.part), flush.pending);

            flush.pending = partsOf(rest).length > 0 ? rest : null;
          }

          throw pickErrorToThrow(failures, []) ?? firstFailure.error;
        }

        return;
      }

      if (succeeded.length > 0) {
        adoptSavedParts(succeeded, changes, toDraft(outcome.snapshot));
      }

      if (succeeded.includes('general')) {
        invalidateProjectQueries('renameProject');
      }
    }

    recordRejections(failures, sentDraft);

    const nowDraft = draftRef.current ?? EMPTY_DRAFT;
    const heldParts = PARTS.filter((part) => activeRejection(part, nowDraft) !== null);
    const failedParts = PARTS.filter(
      (part) => heldParts.includes(part) || failures.some((failure) => failure.part === part),
    );

    if (failedParts.length > 0) {
      const savedParts = attempted.filter((part) => !failedParts.includes(part));
      const heldErrors = heldParts.flatMap((part) => rejectionsRef.current[part]?.error ?? []);

      setSaveFailureMessage(partialSaveSentence(savedParts, failedParts));

      // Không bọc `new Error(câu)`: engine đọc lỗi gốc để biết nên hẹn lại hay dừng (R2).
      const error = pickErrorToThrow(failures, heldErrors);

      if (error !== null) {
        throw error;
      }

      return;
    }

    setConflictMessage(null);
    setSaveFailureMessage(null);
    setServerProblems({});

    if (attempted.length > 0 && previous !== null) {
      // A8: đúng một vé cho mỗi lượt lưu xong cả hai phần. Cửa sổ 8 giây do chính vé
      // giữ (`UNDO_WINDOW_MS`), nên ở đây không có bộ đếm thời gian nào.
      const ticket = createUndoTicket({
        description: UNDO_DESCRIPTION,
        undo: () => {
          commitDraft(previous);
          autosave.notifyChange();
        },
        ...(options.now !== undefined ? { now: options.now } : {}),
      });

      options.onToast?.({
        message: SAVED_TOAST_MESSAGE,
        onUndo: () => {
          ticket.undo();
        },
      });
    }
  };

  useEffect(() => {
    bridgeRef.current = { ...bridgeRef.current, getChanges, save, gateway };
  });

  // R13: hiệu ứng theo `projectId`. Vào thì hạ cờ; tháo (hoặc đổi dự án) mà tự lưu
  // còn dở thì chụp ĐỒNG BỘ bản chờ, bật cờ rồi xả một lượt. Engine không biết gì về
  // việc này — nó cứ hẹn lại theo lịch của nó và `getChanges` trả bản chờ.
  useEffect(() => {
    bridgeRef.current.flush = null;

    return () => {
      const state = autosave.getState();

      if (state === 'saved' || state === 'failed') {
        return;
      }

      const bridge = bridgeRef.current;

      bridge.flush = {
        projectId,
        gateway: bridge.gateway,
        base: baseRef.current,
        pending: bridge.getChanges() ?? null,
      };
      void autosave.saveNow();
    };
  }, [projectId, autosave]);

  // Sau một lần tải lại, bản nháp đã bằng bản đã lưu: để engine ghi nhận nó là `saved`.
  useEffect(() => {
    if (reloadToken > 0) {
      void autosave.saveNow();
    }
  }, [reloadToken, autosave]);

  const editDraft = (patch: Partial<ProjectSettingsDraft>): void => {
    commitDraft({ ...(draftRef.current ?? EMPTY_DRAFT), ...patch });
    setServerProblems((previous) => {
      const edited = (Object.keys(patch) as SettingsProblemKey[]).filter((key) => previous[key] !== undefined);

      if (edited.length === 0) return previous;

      const next: ServerProblems = { ...previous };

      for (const key of edited) {
        delete next[key];
      }

      return next;
    });
    autosave.notifyChange();
  };

  /* ---------------------------------------------------------------------- */
  /* Thành viên (N3, N4) — chỉ khi canEdit.                                  */
  /* ---------------------------------------------------------------------- */

  const memberNames = useMemo<Readonly<Record<string, string>>>(
    () => Object.fromEntries((snapshot?.members ?? []).map((member) => [member.id, member.name])),
    [snapshot],
  );

  const {
    setMemberEmail,
    addMember,
    requestRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,
    ...membersModel
  } = useProjectMembers({
    gateway,
    projectId,
    canEdit,
    queryClient,
    memberNames,
    currentUserId: options.currentUserId,
    now: options.now,
    onToast: options.onToast,
    onSelfRemoved: options.onSelfRemoved,
  });

  /* ---------------------------------------------------------------------- */
  /* Tải lại (A9 khi có nháp chưa lưu).                                       */
  /* ---------------------------------------------------------------------- */

  const hasUnsavedChanges = draft !== null && saved !== null && diffDraft(saved, draft) !== null;

  const performReload = async (): Promise<void> => {
    setReloadDialogOpen(false);
    // Đọc xong mới đổi khoá đồng bộ: đổi trước thì bản nháp nạp lại từ ảnh chụp cũ.
    await settingsQuery.refetch();
    setReloadToken((token) => token + 1);
  };

  /* ---------------------------------------------------------------------- */
  /* Hai việc nguy hiểm (A9).                                                */
  /* ---------------------------------------------------------------------- */

  const openDanger = (action: ProjectSettingsDangerAction): void => {
    setPendingDanger(action);
    setDangerConfirmationText('');
    setDangerFailure(null);
  };

  const cancelDanger = (): void => {
    if (isDangerRunning) return;
    setPendingDanger(null);
    setDangerConfirmationText('');
    setDangerFailure(null);
  };

  const runDeleteAllFloors = (): void => {
    void gateway.deleteAllFloors({ projectId }).then((result) => {
      setDangerRunning(false);

      if (!result.ok) {
        setDangerFailure(describeError(toAppError(result.error)).description);
        return;
      }

      setPendingDanger(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.floor.list(projectId) });
      invalidateProjectQueries('renameProject');

      const { deletedCount, failedFloorIds } = result.data;
      const deleted = formatNumber(deletedCount, { grouping: false });

      options.onToast?.({
        message:
          failedFloorIds.length === 0
            ? `Đã xoá ${deleted} tầng của dự án.`
            : `Đã xoá ${deleted} tầng; còn ${formatNumber(failedFloorIds.length, { grouping: false })} tầng chưa xoá được.`,
      });
    });
  };

  const runDeleteProject = (): void => {
    void gateway.deleteProject({ projectId }).then((result) => {
      setDangerRunning(false);

      if (!result.ok) {
        setDangerFailure(describeError(toAppError(result.error)).description);
        return;
      }

      setPendingDanger(null);
      invalidateProjectQueries('deleteProject');
      // A9 đã hỏi trước bằng hộp thoại, nên A8 không nợ một toast hoàn tác ở đây:
      // không có đường khôi phục nào để hứa.
      if (options.onProjectDeleted === undefined) {
        options.onToast?.({ message: PROJECT_DELETED_NOTICE });
      } else {
        options.onProjectDeleted(PROJECT_DELETED_NOTICE);
      }
    });
  };

  const dangerConfirmationExpected =
    pendingDanger === 'deleteProject' ? (saved?.name ?? snapshot?.name ?? '') : null;

  const canConfirmDanger =
    pendingDanger !== null &&
    canDelete &&
    !isDangerRunning &&
    (dangerConfirmationExpected === null ||
      dangerConfirmationText.trim() === dangerConfirmationExpected.trim());

  const confirmDanger = (): void => {
    if (!canConfirmDanger || pendingDanger === null) return;

    setDangerRunning(true);
    setDangerFailure(null);

    if (pendingDanger === 'deleteAllFloors') {
      runDeleteAllFloors();
      return;
    }

    runDeleteProject();
  };

  /* ---------------------------------------------------------------------- */
  /* Bảy trạng thái.                                                         */
  /* ---------------------------------------------------------------------- */

  const saveState: SaveState = hasLocalProblem ? 'pending' : toSaveState(indicator.state);
  const floorCount = snapshot?.floorCount ?? 0;

  const loadFailure = settingsQuery.isError
    ? settingsQuery.error instanceof Error
      ? settingsQuery.error.message
      : LOAD_FAILURE_FALLBACK
    : null;

  const loadAppError = settingsQuery.error instanceof SettingsLoadError ? settingsQuery.error.appError : null;

  const state = useMemo<SevenState>(() => {
    // Chưa có dữ liệu thì không có gì để xếp lại hay khoá: tải và lỗi tải thắng hai
    // lớp phủ, nếu không màn hẹp vẽ biểu mẫu trống thay cho lỗi (BUG-072).
    if (settingsQuery.isPending) return 'loading';
    if (loadFailure !== null) return 'error';
    if (isCollapsed) return 'collapsed';
    if (!canEdit) return 'forbidden';
    if (floorCount === 0) return 'empty';
    if (saveState === 'saving' || saveState === 'pending' || hasProblem || saveFailureMessage !== null) {
      return 'partial';
    }
    return 'success';
  }, [
    isCollapsed,
    canEdit,
    settingsQuery.isPending,
    loadFailure,
    floorCount,
    saveState,
    hasProblem,
    saveFailureMessage,
  ]);

  const members = useMemo<readonly ProjectSettingsMemberRow[]>(
    () =>
      (snapshot?.members ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        roleLabel: ROLE_LABELS[member.role],
        initials: initialsOf(member.name, member.email),
        removeLabel: `Gỡ ${member.name}`,
      })),
    [snapshot],
  );

  const alwaysTabs: readonly ProjectSettingsTabModel[] = [
    { id: 'general', label: TAB_LABELS.general, problemCount: generalProblemCount },
    { id: 'units', label: TAB_LABELS.units, problemCount: unitsProblemCount },
    { id: 'members', label: TAB_LABELS.members, problemCount: 0 },
  ];

  // Vai không xoá được gì thì thẻ "vùng nguy hiểm" chỉ còn hai nút bấm không nổi
  // và một lời xin lỗi. Bỏ hẳn thẻ đó đi: bày ra rồi khoá lại là hứa một việc
  // rồi rút lại ngay, và nó còn để ngỏ đường tới hộp thoại A9 cho người không
  // có quyền.
  const tabs: readonly ProjectSettingsTabModel[] = canDelete
    ? [...alwaysTabs, { id: 'danger', label: TAB_LABELS.danger, problemCount: 0 }]
    : alwaysTabs;

  const model: ProjectSettingsModel = {
    ...membersModel,
    state,
    canEdit,
    canDelete,
    isReadOnly: !canEdit,
    errorMessage: state === 'error' ? loadFailure : null,
    isProjectMissing: state === 'error' && loadAppError?.kind === 'notFound',
    canRetryLoad: state === 'error' && (loadAppError?.retryable ?? true),
    saveState,
    // Ép `pending` vì lỗi nhập thì nhãn của tự lưu (có thể là "Đã lưu lúc …" cũ) không còn đúng (B-V1-47).
    saveLabel: hasLocalProblem ? null : indicator.label,
    conflictMessage,
    saveFailureMessage,
    isReloadDialogOpen,
    activeTab,
    tabs,
    name: current.name,
    code: current.code,
    address: current.address,
    buildingType: current.buildingType,
    buildingTypeOptions: BUILDING_TYPE_OPTIONS,
    notes: current.notes,
    notesCountLabel:
      `${formatNumber(current.notes.length, { grouping: false })} / ` +
      `${formatNumber(LIMITS.notesMaxLength, { grouping: false })} ký tự`,
    problems,
    lengthUnit: current.lengthUnit,
    lengthUnitOptions: LENGTH_UNIT_OPTIONS,
    areaUnitLabel: `Mét vuông — ví dụ ${formatArea(LIMITS.areaExampleM2)}`,
    snapToleranceMm: current.snapToleranceMm,
    snapToleranceLabel: formatLength(current.snapToleranceMm, { unit: 'mm' }),
    snapToleranceMinMm: LIMITS.snapToleranceMinMm,
    snapToleranceMaxMm: LIMITS.snapToleranceMaxMm,
    confidenceThreshold: current.confidenceThreshold,
    confidenceThresholdLabel: formatPercent(current.confidenceThreshold, { fractionDigits: 0 }),
    scaleMmPerPx: current.scaleMmPerPx,
    scaleLabel: `${formatNumber(current.scaleMmPerPx, { maxFractionDigits: 3 })} milimét trên mỗi điểm ảnh`,
    scalePreviewLabel: scalePreviewLabelFor(current.scaleMmPerPx),
    members,
    memberCountLabel: `${formatNumber(members.length, { grouping: false })} thành viên`,
    floorCount,
    deleteAllFloorsLabel:
      floorCount === 0
        ? 'Dự án chưa có tầng nào để xoá.'
        : `Xoá toàn bộ ${formatNumber(floorCount, { grouping: false })} tầng cùng bản vẽ và mô hình của chúng. Không hoàn tác được.`,
    deleteProjectLabel:
      'Xoá dự án cùng mọi tầng, bản vẽ và mô hình bên trong. Không hoàn tác được.',
    pendingDanger,
    dangerDialogTitle: pendingDanger === null ? null : DANGER_TITLES[pendingDanger],
    dangerDialogMessage:
      pendingDanger === null ? null : (dangerFailure ?? DANGER_MESSAGES[pendingDanger]),
    dangerConfirmLabel: pendingDanger === null ? null : DANGER_CONFIRM_LABELS[pendingDanger],
    dangerConfirmationExpected,
    dangerConfirmationText,
    canConfirmDanger,
    isDangerRunning,
  };

  const actions: ProjectSettingsActions = {
    setActiveTab,
    setName: (value) => editDraft({ name: value }),
    setCode: (value) => editDraft({ code: value }),
    setAddress: (value) => editDraft({ address: value }),
    setBuildingType: (value) => editDraft({ buildingType: value as ProjectBuildingType }),
    setNotes: (value) => editDraft({ notes: value }),
    setLengthUnit: (value) => editDraft({ lengthUnit: value as ProjectLengthUnit }),
    setSnapToleranceMm: (value) => editDraft({ snapToleranceMm: value ?? null }),
    setConfidenceThreshold: (value) => editDraft({ confidenceThreshold: value }),
    setScaleMmPerPx: (value) => editDraft({ scaleMmPerPx: value ?? null }),
    saveNow: () => void autosave.saveNow(),
    retryLoad: () => void settingsQuery.refetch(),
    backToProjects: options.onBackToProjects ?? null,
    // A9: tải lại bỏ bản nháp chưa lưu, nên có nháp thì hỏi trước.
    reloadSettings: () => {
      if (hasUnsavedChanges) {
        setReloadDialogOpen(true);
        return;
      }

      void performReload();
    },
    confirmReload: () => void performReload(),
    cancelReload: () => setReloadDialogOpen(false),
    setMemberEmail,
    addMember,
    requestRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,
    requestDeleteAllFloors: () => openDanger('deleteAllFloors'),
    requestDeleteProject: () => openDanger('deleteProject'),
    setDangerConfirmationText,
    confirmDanger,
    cancelDanger,
  };

  return { ...model, ...actions };
}
