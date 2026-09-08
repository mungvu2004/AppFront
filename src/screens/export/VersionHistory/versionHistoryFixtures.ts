/**
 * Dữ liệu mẫu dùng chung cho `VersionHistory.test.tsx` và `VersionHistory.stories.tsx`.
 *
 * Khuôn theo `shareDialogFixtures.ts`: số liệu KHÔNG viết tay khi repo đã có nguồn (R-70).
 * Cụ thể, mọi câu diff đi qua {@link formatChange}, mọi mốc thời gian đi qua
 * `lib/format/datetime`, và bản thân `VersionDiff` đi ra từ `diffVersions` thật — không có
 * `VersionDiff` nào bị viết tay ở đây.
 *
 * ## Vì sao KHÔNG dùng bộ mẫu A14
 *
 * Bộ mẫu chuẩn (34 phòng / 248,60 m², `SAMPLE_BUILDING`) đã bị đo và loại: đường bao đo ra
 * 238,00 chứ không phải 248,60, và tên phòng của nó là tiếng Anh nên trượt `expectVietnamese`
 * (xem ghi chú khảo sát nội bộ). Vì màn này chỉ cần MỘT `VersionSnapshot` hai tường/một
 * phòng, không cần toàn bộ toà nhà, dữ liệu dưới đây được viết tay có chủ đích — đúng vai
 * một fixture: đóng vai "hai bản ghi máy chủ", không phải một mặt bằng thật.
 *
 * ## Cổng giả
 *
 * {@link createFakeVersionHistoryGateway} không chạm mạng: `listVersions`/`diff` đọc từ một
 * lịch sử giữ trong bộ nhớ, `restore` gọi đúng `restoreVersion` + `appendVersionToHistory`
 * thật của `@/lib/versioning/restore` (số phiên bản luôn tăng thêm 1 — không mô phỏng lại
 * logic đó bằng tay), và phiếu hoàn tác đi qua `createUndoTicket` thật của
 * `@/lib/mutations/undoTicket` (cửa sổ `UNDO_WINDOW_MS`, không viết lại 8000).
 */

import { formatCalendarDate, formatClockTime, formatTimestamp } from '@/lib/format/datetime';
import { formatChange } from '@/lib/format/semantic';
import { createUndoTicket } from '@/lib/mutations/undoTicket';
import type { UndoTicket } from '@/lib/mutations/undoTicket';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { diffVersions } from '@/lib/versioning/diff';
import type { EntityRecord, VersionDiff, VersionSnapshot } from '@/lib/versioning/diff';
import { appendVersionToHistory, restoreVersion } from '@/lib/versioning/restore';
import type { VersionEntry, VersionHistoryEntry, VersionMetadata } from '@/lib/versioning/restore';

import type {
  CompareModel,
  ConflictNoticeModel,
  DiffCountsModel,
  DiffGroupModel,
  DiffRowModel,
  DiffTone,
  JsonDiffLineModel,
  RestoreConfirmModel,
  RestoreOutcome,
  VersionGroupModel,
  VersionHistoryActions,
  VersionHistoryCapabilities,
  VersionHistoryGateway,
  VersionHistoryModel,
  VersionHistoryOption,
  VersionHistoryProps,
  VersionRowModel,
  VisualDiffModel,
} from './types';

/* ==========================================================================
 * 0. Hằng số chung.
 * ========================================================================== */

export const SAMPLE_PROJECT_ID = 'project-1';
export const SAMPLE_FLOOR_ID = 'floor-1';

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;

function minutesBeforeStart(minutes: number): Date {
  return new Date(FAKE_CLOCK_START.getTime() - minutes * MS_PER_MINUTE);
}

/* ==========================================================================
 * 1. Hai bản ghi máy chủ — snapshot cũ và mới, đủ ba loại thay đổi.
 * ========================================================================== */

function emptySnapshot(): VersionSnapshot {
  return { dimension: {}, door: {}, furniture: {}, room: {}, vertex: {}, wall: {}, window: {} };
}

function wall(thicknessMm: number, extra: EntityRecord = {}): EntityRecord {
  return { confidence: 0.9, from: 'V-1', thickness_mm: thicknessMm, to: 'V-2', ...extra };
}

/** Snapshot của v13: tường W-005 và W-014 (dày 200 mm) tồn tại, W-021 chưa có. */
function buildOldSnapshot(): VersionSnapshot {
  const snapshot = emptySnapshot();

  snapshot.wall = { 'W-005': wall(180), 'W-014': wall(200) };

  return snapshot;
}

/** Snapshot của v14: W-005 đã xoá, W-014 dày lên 220 mm, W-021 mới thêm. */
function buildNewSnapshot(): VersionSnapshot {
  const snapshot = emptySnapshot();

  snapshot.wall = { 'W-014': wall(220), 'W-021': wall(150) };

  return snapshot;
}

export const SAMPLE_OLD_SNAPSHOT: VersionSnapshot = buildOldSnapshot();
export const SAMPLE_NEW_SNAPSHOT: VersionSnapshot = buildNewSnapshot();

/** `VersionDiff` THẬT, sinh bởi `diffVersions` — không viết tay (R-70). */
export const SAMPLE_DIFF: VersionDiff = diffVersions(SAMPLE_OLD_SNAPSHOT, SAMPLE_NEW_SNAPSHOT);

/** Không có diff nào cả — nền của phiên bản cũ nhất, không có gì để so với "trước nó". */
export const EMPTY_DIFF: VersionDiff = diffVersions(SAMPLE_OLD_SNAPSHOT, SAMPLE_OLD_SNAPSHOT);

/* ==========================================================================
 * 2. Đếm và câu diff — cả hai đều sinh từ `SAMPLE_DIFF`, không viết số tay.
 * ========================================================================== */

function buildDiffCounts(diff: VersionDiff): DiffCountsModel {
  const added = diff.added.length;
  const removed = diff.removed.length;
  const changed = diff.changed.length;

  return {
    added,
    removed,
    changed,
    addedLabel: `+${String(added)}`,
    removedLabel: `−${String(removed)}`,
    changedLabel: `~${String(changed)}`,
    ariaLabel: `Thêm ${String(added)}, xoá ${String(removed)}, đổi ${String(changed)} mục.`,
  };
}

export const SAMPLE_DIFF_COUNTS: DiffCountsModel = buildDiffCounts(SAMPLE_DIFF);
export const EMPTY_DIFF_COUNTS: DiffCountsModel = buildDiffCounts(EMPTY_DIFF);

/** Một hàng diff cho mỗi mục — câu tiếng thường đi qua `formatChange`, không tự ghép. */
function buildDiffRows(diff: VersionDiff): readonly DiffRowModel[] {
  return [...diff.added, ...diff.removed, ...diff.changed].map((entry) => ({
    id: `${entry.kind}-${entry.entityId}-${entry.field ?? ''}`,
    entityId: entry.entityId,
    entityType: entry.entityType,
    tone: entry.kind,
    sentence: formatChange(entry),
  }));
}

const SAMPLE_DIFF_ROWS: readonly DiffRowModel[] = buildDiffRows(SAMPLE_DIFF);

/** Đúng một nhóm ("tường") vì fixture chỉ đổi tường — đủ ba tông màu (added/removed/changed). */
export const SAMPLE_DIFF_GROUP: DiffGroupModel = {
  entityType: 'wall',
  heading: 'tường',
  count: SAMPLE_DIFF_ROWS.length,
  countLabel: `${String(SAMPLE_DIFF_ROWS.length)} mục`,
  rows: SAMPLE_DIFF_ROWS,
};

/** Xác nhận đủ ba tông — dùng bởi cả story lẫn bài kiểm nền 8%. */
export const SAMPLE_DIFF_TONES: readonly DiffTone[] = ['added', 'removed', 'changed'];

function buildJsonLines(diff: VersionDiff): readonly JsonDiffLineModel[] {
  return JSON.stringify(diff, null, 2)
    .split('\n')
    .map((text, index) => ({ id: `json-${String(index)}`, text, tone: null }));
}

export const SAMPLE_JSON_LINES: readonly JsonDiffLineModel[] = buildJsonLines(SAMPLE_DIFF);

/** Câu bắt buộc của tab "trực quan" — luôn nói rõ đây là mô hình HIỆN TẠI (mục 1 hợp đồng). */
export const SAMPLE_VISUAL_CAPTION =
  'Đang hiện mô hình hiện tại, không phải phiên bản cũ; 3 đối tượng liên quan được đánh dấu.';

export const SAMPLE_VISUAL: VisualDiffModel = {
  isAvailable: true,
  unavailableReason: null,
  isBuilding: false,
  caption: SAMPLE_VISUAL_CAPTION,
  changedEntityIds: ['W-005', 'W-014', 'W-021'],
  hoveredEntityId: null,
};

/* ==========================================================================
 * 3. Ba tab của vùng so sánh.
 * ========================================================================== */

export const SAMPLE_TABS: readonly VersionHistoryOption[] = [
  { id: 'changes', label: 'thay đổi' },
  { id: 'json', label: 'JSON' },
  { id: 'visual', label: 'trực quan' },
];

/* ==========================================================================
 * 4. Bốn phiên bản mẫu, dựng qua `restoreVersion`/`appendVersionToHistory` THẬT.
 * ========================================================================== */

function metadata(id: string, sequence: number, minutesAgo: number): VersionMetadata {
  return {
    id,
    sequence,
    createdAt: minutesBeforeStart(minutesAgo).toISOString(),
    creatorId: 'user-1',
  };
}

const V11: VersionEntry = { ...metadata('v11', 11, 6 * MINUTES_PER_HOUR), snapshot: emptySnapshot() };
const V12: VersionEntry = {
  ...metadata('v12', 12, 4 * MINUTES_PER_HOUR),
  snapshot: SAMPLE_OLD_SNAPSHOT,
};
const V13: VersionEntry = {
  ...metadata('v13', 13, 2 * MINUTES_PER_HOUR),
  snapshot: SAMPLE_OLD_SNAPSHOT,
};
const V14: VersionEntry = { ...metadata('v14', 14, 12), snapshot: SAMPLE_NEW_SNAPSHOT };

/**
 * Lịch sử bốn phiên bản. `v11` là `metadataOnly` — đã bị dọn theo chính sách lưu giữ, còn
 * siêu dữ liệu, mất ảnh chụp (`VersionRowModel.isMetadataOnly`, trạng thái 3 của cột trái).
 */
export const SAMPLE_HISTORY: readonly VersionHistoryEntry[] = [
  { kind: 'full', version: V14 },
  { kind: 'full', version: V13 },
  { kind: 'full', version: V12 },
  { kind: 'metadataOnly', version: V11 },
];

const AUTHOR_NAMES: Readonly<Record<string, string>> = {
  v14: 'Trần Chi',
  v13: 'Nguyễn Bình',
  v12: 'Nguyễn Bình',
  v11: 'Phạm An',
};

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function buildVersionRow(entry: VersionHistoryEntry, overrides: Partial<VersionRowModel> = {}): VersionRowModel {
  const version = entry.version;
  const authorName = AUTHOR_NAMES[version.id] ?? 'Phạm An';
  const isOldest = version.id === 'v11';

  return {
    id: version.id,
    label: `v${String(version.sequence)}`,
    description: isOldest ? 'Bản khởi tạo tầng' : 'Chỉnh sửa tường và bố cục',
    authorName,
    authorInitials: initialsOf(authorName),
    avatarUrl: null,
    relativeTimeLabel: formatTimestamp(new Date(version.createdAt), FAKE_CLOCK_START),
    absoluteTimeLabel: `${formatCalendarDate(new Date(version.createdAt))} ${formatClockTime(new Date(version.createdAt))}`,
    counts: isOldest ? EMPTY_DIFF_COUNTS : SAMPLE_DIFF_COUNTS,
    isCurrent: version.id === 'v14',
    tagLabel: version.id === 'v13' ? 'Duyệt với chủ đầu tư' : null,
    isMetadataOnly: entry.kind === 'metadataOnly',
    retentionNotice: entry.kind === 'metadataOnly' ? 'Đã lưu quá 90 ngày, chỉ còn thông tin cơ bản.' : null,
    isSelectedForCompare: false,
    isPickable: true,
    ...overrides,
  };
}

export const SAMPLE_ROWS: readonly VersionRowModel[] = SAMPLE_HISTORY.map((entry) =>
  buildVersionRow(entry, {
    isSelectedForCompare: entry.version.id === 'v13' || entry.version.id === 'v14',
  }),
);

export const SAMPLE_GROUPS: readonly VersionGroupModel[] = [
  {
    id: 'group-today',
    heading: formatCalendarDate(FAKE_CLOCK_START),
    rows: SAMPLE_ROWS,
  },
];

export const SAMPLE_VERSION_OPTIONS: readonly VersionHistoryOption[] = SAMPLE_ROWS.map((row) => ({
  id: row.id,
  label: row.label,
}));

/* ==========================================================================
 * 5. Vùng so sánh và chân màn.
 * ========================================================================== */

export const SAMPLE_TEACHING_SENTENCE = 'Chỉ có một phiên bản, chưa có gì để so sánh.';

export function buildCompareModel(overrides: Partial<CompareModel> = {}): CompareModel {
  return {
    leftOptions: SAMPLE_VERSION_OPTIONS,
    rightOptions: SAMPLE_VERSION_OPTIONS,
    leftVersionId: 'v13',
    rightVersionId: 'v14',
    activeTab: 'changes',
    tabs: SAMPLE_TABS,
    totals: SAMPLE_DIFF_COUNTS,
    groups: [SAMPLE_DIFF_GROUP],
    jsonLines: SAMPLE_JSON_LINES,
    visual: SAMPLE_VISUAL,
    isRecomputing: false,
    teachingSentence: null,
    ...overrides,
  };
}

/** Câu bắt buộc trước khi bấm phục hồi — không phá huỷ (A9 + cấm tuyệt đối của đặc tả). */
export const SAMPLE_RESTORE_CAPTION =
  'Phục hồi giữ lại trạng thái hiện tại thành một phiên bản riêng; không có gì bị xoá.';

export const SAMPLE_FORBIDDEN_REASON = 'Bạn không có quyền phục hồi phiên bản trên tầng này.';

export function buildRestoreConfirm(overrides: Partial<RestoreConfirmModel> = {}): RestoreConfirmModel {
  return {
    isOpen: false,
    title: 'Phục hồi phiên bản này?',
    reassurance: SAMPLE_RESTORE_CAPTION,
    confirmLabel: 'Phục hồi',
    cancelLabel: 'Huỷ',
    targetVersionLabel: null,
    ...overrides,
  };
}

export const SAMPLE_CONFLICT: ConflictNoticeModel = {
  actorName: 'Nguyễn Bình',
  message: 'Nguyễn Bình đã sửa phiên bản này trước bạn.',
  detail: 'Phiên bản đã đổi kể từ khi bạn mở màn này.',
  dismissLabel: 'Đã hiểu',
};

/* ==========================================================================
 * 6. Mười một hành động — không làm gì; test tự ghi đè bằng `vi.fn()`.
 * ========================================================================== */

export const NOOP_VERSION_HISTORY_ACTIONS: VersionHistoryActions = {
  selectLeftVersion: () => undefined,
  selectRightVersion: () => undefined,
  toggleCompareSelection: () => undefined,
  setTab: () => undefined,
  hoverDiffRow: () => undefined,
  requestRestore: () => undefined,
  confirmRestore: () => undefined,
  cancelRestore: () => undefined,
  exportVersion: () => undefined,
  tagVersion: () => undefined,
  dismissConflict: () => undefined,
};

/* ==========================================================================
 * 7. Bảy trạng thái (A11).
 * ========================================================================== */

export const SAMPLE_SAVED_AT_LABEL = `Đã lưu lúc ${formatClockTime(FAKE_CLOCK_START)}`;

export const SAMPLE_ERROR_MESSAGE = 'Không tải được lịch sử phiên bản. Kiểm tra kết nối rồi thử lại.';

function modelForState(state: SevenState): VersionHistoryModel {
  const base: VersionHistoryModel = {
    state,
    groups: SAMPLE_GROUPS,
    rows: SAMPLE_ROWS,
    versionCount: SAMPLE_ROWS.length,
    isNarrow: false,
    compare: buildCompareModel(),
    canRestore: true,
    restoreHiddenReason: null,
    restoreCaption: SAMPLE_RESTORE_CAPTION,
    restoreConfirm: buildRestoreConfirm(),
    conflict: null,
    errorMessage: null,
    savedAtLabel: SAMPLE_SAVED_AT_LABEL,
  };

  switch (state) {
    case 'empty': {
      // Trạng thái 1: chỉ có một phiên bản — một câu dạy việc, không phải lỗi.
      const onlyRow = buildVersionRow(
        { kind: 'full', version: V14 },
        { isSelectedForCompare: false, tagLabel: null },
      );

      return {
        ...base,
        rows: [onlyRow],
        groups: [{ id: 'group-today', heading: formatCalendarDate(FAKE_CLOCK_START), rows: [onlyRow] }],
        versionCount: 1,
        canRestore: false,
        restoreHiddenReason: 'Chưa có phiên bản cũ nào để phục hồi.',
        savedAtLabel: null,
        compare: buildCompareModel({
          leftVersionId: onlyRow.id,
          rightVersionId: null,
          leftOptions: [{ id: onlyRow.id, label: onlyRow.label }],
          rightOptions: [],
          groups: [],
          totals: EMPTY_DIFF_COUNTS,
          jsonLines: [],
          teachingSentence: SAMPLE_TEACHING_SENTENCE,
        }),
      };
    }
    case 'loading':
      return {
        ...base,
        rows: [],
        groups: [],
        versionCount: 0,
        canRestore: false,
        restoreHiddenReason: 'Đang tải danh sách phiên bản.',
        savedAtLabel: null,
        compare: buildCompareModel({
          leftOptions: [],
          rightOptions: [],
          leftVersionId: null,
          rightVersionId: null,
          groups: [],
          jsonLines: [],
          totals: EMPTY_DIFF_COUNTS,
          isRecomputing: true,
        }),
      };
    case 'partial':
      // Trạng thái 3 lồng bên trong CompareModel: đang tính lại cặp mới vừa chọn.
      return {
        ...base,
        rows: SAMPLE_ROWS.slice(0, 2),
        groups: [{ id: 'group-today', heading: formatCalendarDate(FAKE_CLOCK_START), rows: SAMPLE_ROWS.slice(0, 2) }],
        compare: buildCompareModel({ isRecomputing: true }),
      };
    case 'error':
      return {
        ...base,
        errorMessage: SAMPLE_ERROR_MESSAGE,
      };
    case 'success':
      return base;
    case 'forbidden':
      // Trạng thái 6: so sánh được, ẩn nút phục hồi.
      return {
        ...base,
        canRestore: false,
        restoreHiddenReason: SAMPLE_FORBIDDEN_REASON,
      };
    case 'collapsed':
      // Trạng thái 7: dưới 1024 — danh sách thành Select, so sánh xếp dọc.
      return {
        ...base,
        isNarrow: true,
      };
    default:
      return base;
  }
}

/**
 * Một `VersionHistoryProps` hợp lệ cho một trong bảy trạng thái.
 *
 * @param state một trong bảy trạng thái của A11.
 * @param overrides vá từng phần vào `model`.
 * @param actionOverrides vá từng phần vào `actions` — nơi `vi.fn()` đi vào.
 */
export function buildVersionHistoryProps(
  state: SevenState,
  overrides: Partial<VersionHistoryModel> = {},
  actionOverrides: Partial<VersionHistoryActions> = {},
): VersionHistoryProps {
  return {
    model: { ...modelForState(state), ...overrides },
    actions: { ...NOOP_VERSION_HISTORY_ACTIONS, ...actionOverrides },
  };
}

/* ==========================================================================
 * 8. Cổng giả — không chạm mạng, dùng bởi bài kiểm hook.
 * ========================================================================== */

function findFullEntry(history: readonly VersionHistoryEntry[], versionId: string): VersionEntry {
  const entry = history.find((item) => item.version.id === versionId);

  if (entry === undefined || entry.kind !== 'full') {
    throw new Error(`fixture: không có snapshot đầy đủ cho phiên bản ${versionId}`);
  }

  return entry.version;
}

export interface FakeVersionHistoryGatewayOptions {
  readonly now?: () => Date;
  readonly capabilities?: Partial<VersionHistoryCapabilities>;
  /** Ghi đè toàn bộ kết quả `restore` — dùng để dựng kịch bản 409. */
  readonly onRestore?: (versionId: string) => RestoreOutcome | Promise<RestoreOutcome>;
}

export const SAMPLE_CAPABILITIES: VersionHistoryCapabilities = {
  canShowCurrentModel3d: true,
  canHighlightEntity: true,
  canTagVersion: true,
  // NOT FOUND ở tầng logic (mục 2 hợp đồng) — luôn false, affordance rời khỏi DOM (R-69).
  canGroupByAuthor: false,
  canExportVersion: true,
};

/**
 * Một `VersionHistoryGateway` không chạm mạng, đúng khuôn `shareDialogGateway.ts`.
 *
 * `restore` gọi đúng `restoreVersion`/`appendVersionToHistory` thật — số phiên bản sau khi
 * phục hồi LUÔN tăng thêm 1, vì đó là hành vi thật của hai hàm đó, không phải một con số
 * gán tay ở đây. Phiếu hoàn tác đi qua `createUndoTicket` thật, nên `UNDO_WINDOW_MS` chi
 * phối nó đúng như trong sản phẩm.
 */
export function createFakeVersionHistoryGateway(
  options: FakeVersionHistoryGatewayOptions = {},
): VersionHistoryGateway {
  const now = options.now ?? (() => FAKE_CLOCK_START);
  let history: readonly VersionHistoryEntry[] = SAMPLE_HISTORY;
  let nextSequence = 15;

  return {
    capabilities: { ...SAMPLE_CAPABILITIES, ...options.capabilities },
    listVersions: () => Promise.resolve(history),
    diff: (leftVersionId, rightVersionId) =>
      Promise.resolve(
        diffVersions(
          findFullEntry(history, leftVersionId).snapshot,
          findFullEntry(history, rightVersionId).snapshot,
        ),
      ),
    restore: async (versionId): Promise<RestoreOutcome> => {
      if (options.onRestore) {
        return options.onRestore(versionId);
      }

      const sourceVersion = findFullEntry(history, versionId);
      const newVersion: VersionMetadata = {
        id: `v${String(nextSequence)}`,
        sequence: nextSequence,
        createdAt: now().toISOString(),
        creatorId: 'user-1',
      };

      nextSequence += 1;

      const { restoredVersion } = restoreVersion({
        floorId: SAMPLE_FLOOR_ID,
        newVersion,
        sourceVersion,
      });

      history = appendVersionToHistory(history, restoredVersion);

      const undoTicket: UndoTicket = createUndoTicket({
        description: `Hoàn tác phục hồi ${newVersion.id}`,
        now: () => now().getTime(),
        undo: () => undefined,
      });

      return { kind: 'restored', restoredVersion, history, undoTicket };
    },
    undoRestore: () => {
      history = history.slice(1);

      return Promise.resolve(history);
    },
    tagVersion: (versionId, label) => {
      const entry = findFullEntry(history, versionId);
      const updated: VersionMetadata = {
        id: entry.id,
        sequence: entry.sequence,
        createdAt: entry.createdAt,
        creatorId: entry.creatorId,
        note: label,
      };

      return Promise.resolve(updated);
    },
  };
}
