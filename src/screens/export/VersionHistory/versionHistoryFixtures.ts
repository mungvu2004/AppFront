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
 * Bộ mẫu chuẩn (14 phòng / 248,60 m², `SAMPLE_BUILDING`) đã bị loại: tên phòng của nó là
 * tiếng Anh nên trượt `expectVietnamese` (đường bao từng đo ra 238,00 — đã sửa ở B-V8-10). Vì màn này chỉ cần MỘT `VersionSnapshot` hai tường/một
 * phòng, không cần toàn bộ toà nhà, dữ liệu dưới đây được viết tay có chủ đích — đúng vai
 * một fixture: đóng vai "hai bản ghi máy chủ", không phải một mặt bằng thật.
 *
 * ## Cổng giả
 *
 * {@link createFakeVersionHistoryGateway} không chạm mạng: nó là cổng THẬT
 * (`createVersionHistoryGateway`) nối vào máy chủ giả {@link createVersionsServerFake} — N17
 * (`listVersionPage`), N18 (`readSnapshot`), N16 (`readFloorLayer`), N19 (`restore`/`revertRestore`)
 * đọc/ghi một lịch sử giữ trong bộ nhớ, không có logic phiên bản viết tay ở cổng.
 */

import { formatCalendarDate, formatClockTime, formatTimestamp } from '@/lib/format/datetime';
import { createApiClient } from '@/api/client';
import { formatChange } from '@/lib/format/semantic';
import type { HttpClient, HttpError, Result } from '@/lib/http';
import { FAKE_CLOCK_START } from '@/lib/testing/fakeClock';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';
import { diffVersions } from '@/lib/versioning/diff';
import type { EntityRecord, VersionDiff, VersionSnapshot } from '@/lib/versioning/diff';
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
import { createVersionHistoryGateway } from './versionHistoryGateway';
import { NO_MODEL_REASON } from './versionHistoryScene';

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

/**
 * Snapshot của v15, so với v14: W-021 đã xoá, W-014 dày lên 240 mm, W-030 mới thêm — một
 * thêm, một bớt, một đổi, nên số đếm của hàng v15 (`SAMPLE_DIFF_COUNTS`) là diff thật.
 */
function buildLatestSnapshot(): VersionSnapshot {
  const snapshot = emptySnapshot();

  snapshot.wall = { 'W-014': wall(240), 'W-030': wall(120) };

  return snapshot;
}

export const SAMPLE_OLD_SNAPSHOT: VersionSnapshot = buildOldSnapshot();
export const SAMPLE_NEW_SNAPSHOT: VersionSnapshot = buildNewSnapshot();
const SAMPLE_LATEST_SNAPSHOT: VersionSnapshot = buildLatestSnapshot();

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

/**
 * Không có đồ thị không gian trong fixture, nên tab "trực quan" ở đúng nhánh mà
 * `buildVisualModel` sinh ra trong hoàn cảnh ấy: `sceneFrame` là `null` ⇒ `isAvailable`
 * là `false` và lý do là `NO_MODEL_REASON` (`versionHistoryScene.ts:34`). `isBuilding`
 * bắt buộc là `false` vì mã thật tính nó bằng `isAvailable && isFetchingDiff` — một
 * fixture "đang dựng" mà không có cảnh là một trạng thái mã thật không sinh ra được.
 * `caption` vẫn giữ nguyên: nó là trường bắt buộc của hợp đồng, và giá trị này đúng bằng
 * câu `buildVisualModel` sẽ ghép cho ba đối tượng đã đổi.
 */
export const SAMPLE_VISUAL: VisualDiffModel = {
  isAvailable: false,
  unavailableReason: NO_MODEL_REASON,
  isBuilding: false,
  caption: SAMPLE_VISUAL_CAPTION,
  sceneLevels: [],
  sceneFrame: null,
  changedEntityIds: ['W-005', 'W-014', 'W-021'],
  hoveredEntityId: null,
};

/* ==========================================================================
 * 3. Ba tab của vùng so sánh.
 * ========================================================================== */

export const SAMPLE_TABS: readonly VersionHistoryOption[] = [
  { id: 'changes', label: 'Thay đổi' },
  { id: 'json', label: 'JSON' },
  { id: 'visual', label: 'Trực quan' },
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
/** Bản mới nhất — hiện tại. `v14` (bản đang xem) vì thế không hiện tại và vẫn phục hồi được. */
const V15: VersionEntry = { ...metadata('v15', 15, 6), snapshot: SAMPLE_LATEST_SNAPSHOT };

/**
 * Lịch sử năm phiên bản. `v11` là `metadataOnly` — đã bị dọn theo chính sách lưu giữ, còn
 * siêu dữ liệu, mất ảnh chụp (`VersionRowModel.isMetadataOnly`, trạng thái 3 của cột trái).
 */
export const SAMPLE_HISTORY: readonly VersionHistoryEntry[] = [
  { kind: 'full', version: V15 },
  { kind: 'full', version: V14 },
  { kind: 'full', version: V13 },
  { kind: 'full', version: V12 },
  { kind: 'metadataOnly', version: V11 },
];

const AUTHOR_NAMES: Readonly<Record<string, string>> = {
  v15: 'Phạm An',
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

/** Ảnh chụp của một mục lịch sử; mục `metadataOnly` của bộ mẫu vẫn mang ảnh chụp rỗng (`V11`). */
function snapshotOf(entry: VersionHistoryEntry | undefined): VersionSnapshot | undefined {
  const version = entry?.version;

  return version !== undefined && 'snapshot' in version ? version.snapshot : undefined;
}

/** Đếm của một hàng = diff thật của ảnh chụp nó so với bản ngay trước (`SAMPLE_HISTORY` xếp mới đến cũ); bản cũ nhất không có gì để so. */
function countsAgainstPrevious(entry: VersionHistoryEntry): DiffCountsModel {
  const index = SAMPLE_HISTORY.indexOf(entry);
  const row = snapshotOf(SAMPLE_HISTORY[index]);
  const previous = snapshotOf(SAMPLE_HISTORY[index + 1]);

  if (row === undefined || previous === undefined) return EMPTY_DIFF_COUNTS;

  return buildDiffCounts(diffVersions(previous, row));
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
    counts: countsAgainstPrevious(entry),
    // Bản hiện tại luôn là bản mới nhất của lịch sử mẫu (`v15`).
    isCurrent: version.id === 'v15',
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
  loadMoreVersions: () => undefined,
  selectFloor: () => undefined,
};

/** Hai tầng mẫu cho ô "Tầng". */
export const SAMPLE_FLOOR_OPTIONS: readonly VersionHistoryOption[] = [
  { id: 'L-LEVEL000001', label: 'Tầng 1' },
  { id: 'L-LEVEL000002', label: 'Tầng 2' },
];

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
    // Không có endpoint gắn nhãn ⇒ affordance gắn nhãn rời khỏi DOM (mục 2 hợp đồng, R-69).
    canTagVersion: false,
    // Nơi gọi có cấp `onExportVersion` ⇒ nút "xuất phiên bản này" ở lại trong DOM (R-73).
    canExportVersion: true,
    canLoadMoreVersions: false,
    floorSelect: { label: 'Tầng', options: SAMPLE_FLOOR_OPTIONS, selectedId: 'L-LEVEL000001' },
    emptyTitle: 'Tầng 1 chưa có phiên bản nào',
  };

  switch (state) {
    case 'empty': {
      // Trạng thái 1: chỉ có một phiên bản — một câu dạy việc, không phải lỗi.
      const onlyRow = buildVersionRow(
        { kind: 'full', version: V14 },
        { isCurrent: true, isSelectedForCompare: false, tagLabel: null },
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
        rows: SAMPLE_ROWS.slice(0, 3),
        groups: [{ id: 'group-today', heading: formatCalendarDate(FAKE_CLOCK_START), rows: SAMPLE_ROWS.slice(0, 3) }],
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
 * 8. Máy chủ giả N15–N20 — thân phản hồi là DỮ LIỆU DÂY (literal), giải mã bằng
 *    `createApiClient` thật; cổng là `createVersionHistoryGateway` thật.
 * ========================================================================== */

export const WIRE_PROJECT_ID = 'project-1';
export const WIRE_FLOOR_ID = 'L-LEVEL000001';

export const WIRE_VERSION_IDS = {
  v1: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T1A',
  v2: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T2B',
  v3: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T3C',
  v4: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T4D',
  v5: 'ver_01J9ZV8Q3M7X5B2N4K6P8R0T5E',
} as const;

const WIRE_USER_ID = 'usr_01J9ZV8Q3M7X5B2N4K6P8R0T1A';

export function wireWall(id: string, thicknessMm: number, startX: number): Record<string, unknown> {
  return {
    centreline: { end: { x: startX + 4000, y: 0 }, start: { x: startX, y: 0 } },
    confidence: 1,
    heightMm: 2800,
    id,
    kind: 'partition',
    levelId: WIRE_FLOOR_ID,
    openingIds: [],
    reviewed: true,
    source: 'human',
    thicknessMm,
  };
}

export const wireLayer = (walls: readonly Record<string, unknown>[]) => ({ furniture: [], openings: [], rooms: [], walls });

export const WIRE_LEVEL = {
  confidence: 1,
  elevationMm: 0,
  heightMm: 3000,
  id: WIRE_FLOOR_ID,
  name: 'Tầng 1',
  order: 0,
  reviewed: true,
  source: 'human',
};

/** Lớp đang có trên máy chủ (bản v3) và lớp của bản v2. */
export const WIRE_CURRENT_WALLS = [wireWall('W-WALL000001', 220, 0), wireWall('W-WALL000002', 150, 5000)];
export const WIRE_V2_WALLS = [wireWall('W-WALL000001', 200, 0)];

/** Ba bản N17, `sequence` giảm dần. v3 là đầu ra AI và trùng `revision` 5 của tầng. */
export function wireSummaries(): Record<string, unknown>[] {
  return [
    {
      createdAt: '2026-09-08T08:50:00.000Z',
      creatorId: 'system:pipeline',
      creatorName: 'hệ thống AI',
      floorRevision: 5,
      hasSnapshot: true,
      id: WIRE_VERSION_IDS.v3,
      note: 'trạng thái sau khi ghi kết quả AI',
      sequence: 3,
    },
    {
      createdAt: '2026-09-08T07:00:00.000Z',
      creatorId: WIRE_USER_ID,
      creatorName: 'Nguyễn Bình',
      floorRevision: 3,
      hasSnapshot: true,
      id: WIRE_VERSION_IDS.v2,
      label: 'Duyệt với chủ đầu tư',
      sequence: 2,
    },
    {
      createdAt: '2026-09-07T07:00:00.000Z',
      creatorId: WIRE_USER_ID,
      creatorName: 'Phạm An',
      floorRevision: 1,
      hasSnapshot: false,
      id: WIRE_VERSION_IDS.v1,
      sequence: 1,
    },
  ];
}

export function wireGraphDocument(revision: number): Record<string, unknown> {
  return {
    floorRevisions: [{ floorId: WIRE_FLOOR_ID, revision }],
    graph: {
      axes: [],
      building: { confidence: 1, datumElevationMm: 0, name: 'Nhà mẫu', reviewed: true, source: 'human' },
      dimensions: [],
      furniture: [],
      levels: [WIRE_LEVEL],
      notes: [],
      openings: [],
      rooms: [],
      walls: WIRE_CURRENT_WALLS,
    },
  };
}

export function wireError(status: number, code: string, extra: Record<string, unknown> = {}): HttpError {
  return { code, kind: 'http', raw: { code, requestId: 'req-version', ...extra }, requestId: 'req-version', retryable: false, status };
}

type Reply = Result<unknown, HttpError>;
type Handler = (request: { readonly path: string; readonly query: Readonly<Record<string, unknown>>; readonly body: unknown }) => Reply | Promise<Reply>;

/** Một lượt gọi đã ghi lại: phương thức, đường, query, thân. */
export interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly query: Readonly<Record<string, unknown>>;
  readonly body: unknown;
}

export interface VersionsServerFake {
  readonly http: HttpClient;
  readonly calls: RecordedCall[];
  /** `revision` của tầng trên máy chủ giả. */
  revision: number;
  /** Ghi đè một tuyến: `'POST restore'`, `'GET snapshot'`, `'GET list'`, `'PATCH label'`, `'GET layer'`, `'PUT layer'`. */
  readonly override: (route: string, handler: Handler) => void;
}

const routeOf = (method: string, path: string): string => {
  if (path.endsWith('/restore')) return `${method} restore`;
  if (path.endsWith('/snapshot')) return `${method} snapshot`;
  if (path.endsWith('/label')) return `${method} label`;
  if (path.endsWith('/spatial/layer')) return `${method} layer`;
  if (path.endsWith('/spatial')) return `${method} graph`;
  return `${method} list`;
};

const answer = (data: unknown): Reply => ({ data, ok: true });

/**
 * Máy chủ giả: N17 trả `wireSummaries()`, N18 lớp theo bản, N19 sinh bản mới với
 * `floorRevision` = base + 1 (base cũ → 409), N16/#35 theo `revision` đang giữ.
 */
export function createVersionsServerFake(initialRevision = 5): VersionsServerFake {
  const overrides = new Map<string, Handler>();
  const calls: RecordedCall[] = [];
  let summaries = wireSummaries();
  let layerWalls: readonly Record<string, unknown>[] = WIRE_CURRENT_WALLS;

  const call = async <T,>(method: string, path: string, options?: { query?: Record<string, unknown>; body?: unknown }) => {
    const request = { body: options?.body, path, query: options?.query ?? {} };
    const route = routeOf(method, path);

    calls.push({ method, ...request });

    return (await (overrides.get(route) ?? defaults[route] ?? (() => answer(null)))(request)) as Result<T, HttpError>;
  };
  const fake: VersionsServerFake = {
    calls,
    http: {
      delete: (path, options) => call('DELETE', path, options),
      events: { emit: () => undefined, on: () => () => undefined },
      get: (path, options) => call('GET', path, options),
      getRecentRequests: () => [],
      patch: (path, options) => call('PATCH', path, options),
      post: (path, options) => call('POST', path, options),
      put: (path, options) => call('PUT', path, options),
    },
    override: (route, handler) => {
      overrides.set(route, handler);
    },
    revision: initialRevision,
  };

  const defaults: Record<string, Handler> = {
    'GET list': () => answer({ items: summaries }),
    'GET snapshot': ({ path }) =>
      answer({ dimensions: [], layer: wireLayer(path.includes(WIRE_VERSION_IDS.v2) ? WIRE_V2_WALLS : WIRE_CURRENT_WALLS), versionId: path.split('/')[4] }),
    'POST restore': ({ body, path }) => {
      const base = (body as { baseVersion: number }).baseVersion;

      if (base !== fake.revision) {
        return { error: wireError(409, 'VERSION_CONFLICT', { currentVersion: fake.revision, remoteChanges: [] }), ok: false };
      }

      const sequence = summaries.length + 1;
      const id = sequence === 4 ? WIRE_VERSION_IDS.v4 : WIRE_VERSION_IDS.v5;

      fake.revision += 1;
      layerWalls = path.includes(WIRE_VERSION_IDS.v2) ? WIRE_V2_WALLS : WIRE_CURRENT_WALLS;
      const created = {
        createdAt: '2026-09-08T09:00:00.000Z',
        creatorId: WIRE_USER_ID,
        creatorName: 'Kỹ sư mẫu',
        floorRevision: fake.revision,
        hasSnapshot: true,
        id,
        sequence,
      };

      summaries = [created, ...summaries];

      return answer(created);
    },
    'PATCH label': ({ body, path }) => {
      const label = (body as { label: string }).label;
      const found = summaries.find((item) => path.includes(String(item.id))) ?? summaries[0];

      return answer({ ...found, ...(label.length > 0 ? { label } : { label: undefined }) });
    },
    'GET layer': () => answer({ axes: [], dimensions: [], layer: wireLayer(layerWalls), level: WIRE_LEVEL, revision: fake.revision }),
    'PUT layer': ({ body }) => {
      const write = body as { baseVersion: number; body: { layer: unknown } };

      if (write.baseVersion !== fake.revision) {
        return { error: wireError(409, 'VERSION_CONFLICT', { currentVersion: fake.revision, remoteChanges: [] }), ok: false };
      }

      fake.revision += 1;

      return answer({ layer: write.body.layer, revision: fake.revision });
    },
    'GET graph': () => answer(wireGraphDocument(fake.revision)),
  };

  return fake;
}

export interface FakeVersionHistoryGatewayOptions {
  readonly now?: () => Date;
  readonly server?: VersionsServerFake;
}

export const SAMPLE_CAPABILITIES: VersionHistoryCapabilities = {
  canShowCurrentModel3d: true,
  canHighlightEntity: true,
  canTagVersion: true,
  // NOT FOUND ở tầng logic (mục 2 hợp đồng) — luôn false, affordance rời khỏi DOM (R-69).
  canGroupByAuthor: false,
  canExportVersion: true,
};

/** Cổng THẬT trên máy chủ giả — không mạng, không cổng viết tay. */
export function createFakeVersionHistoryGateway(options: FakeVersionHistoryGatewayOptions = {}): VersionHistoryGateway {
  const server = options.server ?? createVersionsServerFake();

  return createVersionHistoryGateway({
    apiClient: createApiClient(server.http),
    projectId: WIRE_PROJECT_ID,
    floorId: WIRE_FLOOR_ID,
    canExportVersion: true,
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
}
