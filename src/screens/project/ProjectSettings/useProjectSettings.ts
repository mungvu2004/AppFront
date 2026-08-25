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
 * ## Bảy trường chưa có dây
 *
 * Xem `projectSettingsGateway.ts`. Với hook này chúng không khác gì ba trường
 * kia: cùng đi qua một bản vá, cùng một lượt tự lưu.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { SaveState } from '@/components/feedback/SaveIndicator';
import type { SelectOption } from '@/components/ui/Select';
import { millimetresPerPixel, pixels, scaleFromRatio } from '@/domain/units/scale';
import type { AutosaveState } from '@/lib/autosave/createAutosave';
import { createAutosave } from '@/lib/autosave/createAutosave';
import { can } from '@/lib/auth/permissions';
import { describeError, toAppError } from '@/lib/errors';
import { formatArea, formatLength } from '@/lib/format/measure';
import { formatNumber, formatPercent } from '@/lib/format/number';
import type { Announcer } from '@/lib/input/announcer';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
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
  type ProjectSettingsPatch,
  type ProjectSettingsSnapshot,
} from './projectSettingsGateway';

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
 * `collapsed → forbidden → loading → error → empty → partial → success`.
 * Mười điều còn lại đọc *ở bậc mà chúng thắng* — hai lớp phủ `collapsed` và
 * `forbidden` không bao giờ làm dữ liệu biến mất, chúng chỉ đổi cách xếp và
 * quyền sửa.
 *
 * 1. `errorMessage !== null` ⟺ `state === 'error'`. Đây là lỗi ĐỌC, và
 *    `errorMessage` được đặt sau khi bậc thang chạy xong nên hai vế khớp đúng.
 * 2. `state === 'loading'` ⇒ mọi ô dữ liệu mang mặc định rỗng, và view vẽ
 *    khung xương thay cho biểu mẫu.
 * 3. `canEdit === false` ⟺ `isReadOnly === true`, và khi màn không thu gọn thì
 *    cả hai ⟺ `state === 'forbidden'`. Dữ liệu vẫn hiện đầy đủ; chỉ mất quyền
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
export interface ProjectSettingsModel {
  readonly state: SevenState;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
  readonly isReadOnly: boolean;
  readonly errorMessage: string | null;
  readonly saveState: SaveState;
  readonly saveLabel: string;
  readonly conflictMessage: string | null;
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

export interface ProjectSettingsActions {
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
  readonly reloadSettings: () => void;
  readonly requestDeleteAllFloors: () => void;
  readonly requestDeleteProject: () => void;
  readonly setDangerConfirmationText: (value: string) => void;
  readonly confirmDanger: () => void;
  readonly cancelDanger: () => void;
}

/** Mọi prop view nhận — mô hình cộng hành động, đã gộp sẵn (mục D). */
export interface ProjectSettingsViewProps extends ProjectSettingsModel, ProjectSettingsActions {}

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
  /** Gọi sau khi dự án đã bị xoá, để nơi gọi điều hướng đi nơi khác. */
  readonly onProjectDeleted?: () => void;
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

function codeProblemFor(code: string): string | null {
  if (code.length > LIMITS.codeMaxLength) {
    return `Mã dự án không quá ${formatNumber(LIMITS.codeMaxLength, { grouping: false })} ký tự.`;
  }
  return null;
}

function addressProblemFor(address: string): string | null {
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
  if (value < LIMITS.snapToleranceMinMm || value > LIMITS.snapToleranceMaxMm) {
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
  { value: 'residential', label: 'nhà ở' },
  { value: 'commercial', label: 'thương mại' },
  { value: 'industrial', label: 'công nghiệp' },
  { value: 'mixed', label: 'hỗn hợp' },
  { value: 'other', label: 'khác' },
];

const LENGTH_UNIT_OPTIONS: readonly SelectOption[] = [
  { value: 'mm', label: 'milimét (mm)' },
  { value: 'm', label: 'mét (m)' },
];

const TAB_LABELS: Readonly<Record<ProjectSettingsTabId, string>> = {
  general: 'chung',
  units: 'đơn vị đo',
  members: 'thành viên',
  danger: 'vùng nguy hiểm',
};

const ROLE_LABELS: Readonly<Record<ProjectRole, string>> = {
  admin: 'quản trị',
  engineer: 'kỹ sư',
  viewer: 'người xem',
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

/** Hai chữ cái đầu của hai từ cuối trong tên — cùng cách `ProjectDashboard` dựng chữ tắt. */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/u).filter((word) => word.length > 0);
  const tail = words.slice(-2);
  return tail.map((word) => word.charAt(0)).join('');
}

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

/** Những gì lượt tự lưu cần đọc lúc nó chạy, luôn là bản mới nhất (khuôn "ref mới nhất"). */
interface AutosaveBridge {
  readonly getChanges: () => ProjectSettingsPatch | undefined;
  readonly save: (changes: ProjectSettingsPatch) => Promise<void>;
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
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [pendingDanger, setPendingDanger] = useState<ProjectSettingsDangerAction | null>(null);
  const [dangerConfirmationText, setDangerConfirmationText] = useState('');
  const [dangerFailure, setDangerFailure] = useState<string | null>(null);
  const [isDangerRunning, setDangerRunning] = useState(false);

  const detectedNarrow = useNarrowViewport();
  const isCollapsed = options.forceCollapsed ?? detectedNarrow;

  const canEdit = can('edit', 'project.settings', { roles });
  const canDelete = canEdit && roles.includes('admin');

  const settingsQuery = useQuery({
    queryKey: projectSettingsQueryKey(projectId),
    queryFn: async (): Promise<ProjectSettingsSnapshot> => {
      const result = await gateway.read({ projectId });

      if (!result.ok) {
        throw new Error(describeError(toAppError(result.error)).description);
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
    setDraft(initial);
    setSaved(initial);
  }

  const current = draft ?? EMPTY_DRAFT;
  const hasData = draft !== null;

  const problems = useMemo<ProjectSettingsProblems>(
    () =>
      hasData
        ? {
            name: nameProblemFor(current.name),
            code: codeProblemFor(current.code),
            address: addressProblemFor(current.address),
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
    [hasData, current],
  );

  const generalProblemCount = [problems.name, problems.code, problems.address, problems.notes].filter(
    (problem) => problem !== null,
  ).length;
  const unitsProblemCount = [
    problems.snapToleranceMm,
    problems.confidenceThreshold,
    problems.scaleMmPerPx,
  ].filter((problem) => problem !== null).length;
  const hasProblem = generalProblemCount + unitsProblemCount > 0;

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (D-07) và vé hoàn tác (D-05).                                    */
  /* ---------------------------------------------------------------------- */

  const invalidateProjectQueries = (): void => {
    // `WRITE_OPERATIONS` chưa có mục nào cho sửa hay xoá dự án, nên gọi thẳng
    // với khoá dựng từ chính `queryKeys`; mượn tên `createProject` cho một lượt
    // xoá thì bảng vô hiệu hoá sẽ nói dối về việc gì vừa xảy ra (nợ T-07).
    void queryClient.invalidateQueries({ queryKey: queryKeys.project.list() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.project.detail(projectId) });
  };

  // Khuôn "ref mới nhất" (`src/hooks/useShortcut.ts:180-182`): `createAutosave`
  // được dựng đúng một lần, nhưng thứ nó gọi 800 ms sau phải là bản nháp mới
  // nhất chứ không phải bản của lượt render đã tạo ra nó.
  const bridgeRef = useRef<AutosaveBridge>({
    getChanges: () => undefined,
    save: async () => undefined,
  });

  const [autosave] = useState(() =>
    createAutosave<ProjectSettingsPatch>({
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

  const getChanges = (): ProjectSettingsPatch | undefined => {
    if (draft === null || saved === null || hasProblem) {
      return undefined;
    }

    return diffDraft(saved, draft) ?? undefined;
  };

  const save = async (changes: ProjectSettingsPatch): Promise<void> => {
    const previous = saved;
    const applied = draft;
    const result = await gateway.update({ projectId, patch: changes });

    if (!result.ok) {
      const appError = toAppError(result.error);

      // D-09: 409 KHÔNG ném ra. Ném thì `createAutosave` thử lại theo lịch
      // 5/15/45 giây, tức ghi đè im lặng lên bản của người khác. Nó dừng lại,
      // nói ra, và để người dùng nạp lại.
      if (appError.kind === 'conflict') {
        setConflictMessage(describeError(appError).description);
        return;
      }

      throw new Error(describeError(appError).description);
    }

    setConflictMessage(null);

    if (applied !== null) {
      setSaved(applied);
    }

    invalidateProjectQueries();

    if (previous !== null) {
      // A8: đúng một vé cho mỗi lượt lưu thành công. Cửa sổ 8 giây do chính vé
      // giữ (`UNDO_WINDOW_MS`), nên ở đây không có bộ đếm thời gian nào.
      const ticket = createUndoTicket({
        description: UNDO_DESCRIPTION,
        undo: () => {
          setDraft(previous);
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
    bridgeRef.current = { getChanges, save };
  });

  const editDraft = (patch: Partial<ProjectSettingsDraft>): void => {
    setDraft((previous) => ({ ...(previous ?? EMPTY_DRAFT), ...patch }));
    autosave.notifyChange();
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
      invalidateProjectQueries();

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
      invalidateProjectQueries();
      // A9 đã hỏi trước bằng hộp thoại, nên A8 không nợ một toast hoàn tác ở đây:
      // không có đường khôi phục nào để hứa.
      options.onToast?.({ message: 'Đã xoá dự án.' });
      options.onProjectDeleted?.();
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

  const saveState: SaveState = hasProblem ? 'pending' : toSaveState(indicator.state);
  const floorCount = snapshot?.floorCount ?? 0;

  const loadFailure = settingsQuery.isError
    ? settingsQuery.error instanceof Error
      ? settingsQuery.error.message
      : LOAD_FAILURE_FALLBACK
    : null;

  const state = useMemo<SevenState>(() => {
    if (isCollapsed) return 'collapsed';
    if (!canEdit) return 'forbidden';
    if (settingsQuery.isPending) return 'loading';
    if (loadFailure !== null) return 'error';
    if (floorCount === 0) return 'empty';
    if (saveState === 'saving' || saveState === 'pending' || hasProblem) return 'partial';
    return 'success';
  }, [isCollapsed, canEdit, settingsQuery.isPending, loadFailure, floorCount, saveState, hasProblem]);

  const members = useMemo<readonly ProjectSettingsMemberRow[]>(
    () =>
      (snapshot?.members ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        roleLabel: ROLE_LABELS[member.role],
        initials: initialsOf(member.name),
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
    state,
    canEdit,
    canDelete,
    isReadOnly: !canEdit,
    errorMessage: state === 'error' ? loadFailure : null,
    saveState,
    saveLabel: indicator.label,
    conflictMessage,
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
    areaUnitLabel: `mét vuông — ví dụ ${formatArea(LIMITS.areaExampleM2)}`,
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
    reloadSettings: () => {
      setConflictMessage(null);
      setReloadToken((token) => token + 1);
      void settingsQuery.refetch();
    },
    requestDeleteAllFloors: () => openDanger('deleteAllFloors'),
    requestDeleteProject: () => openDanger('deleteProject'),
    setDangerConfirmationText,
    confirmDanger,
    cancelDanger,
  };

  return { ...model, ...actions };
}
