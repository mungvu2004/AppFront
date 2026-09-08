/**
 * Phép chuyển thuần của S-33 — từ dữ liệu phiên bản sang các mảnh của
 * `VersionHistoryModel`.
 *
 * Tách khỏi `useVersionHistory.ts` vì R-22: gộp lại thì một file vượt 400 dòng.
 * File này **không có React**, nên mọi hàm ở đây test được ngoài một cây React và
 * hook chỉ còn phần trạng thái.
 *
 * Ba điều file này KHÔNG làm, và đó là chủ ý:
 *
 * - **Không tự so dữ liệu.** Số đếm của từng hàng đi qua `diffVersions`
 *   (`@/lib/versioning/diff`) — hàm thuần đã có; ở đây chỉ đếm `.length` của ba mảng
 *   nó trả về, đúng như ghi chú khảo sát nói: tầng logic không có sẵn hàm nào trả
 *   `{added, removed, changed}`.
 * - **Không tự ghép câu diff.** Mỗi câu tiếng thường là một lượt gọi `formatChange`
 *   (`@/lib/format/semantic`), và không có phép quy đổi đơn vị nào ở đây (R-61).
 * - **Không tự định dạng số.** `formatNumber`/`formatCalendarDate`/`formatClockTime`
 *   làm việc đó, nên dấu thập phân là dấu phẩy ở mọi nơi (A15).
 */

import { millimetres, millimetresToMetres, RADIANS_PER_TURN } from '@/domain/units/types';
import {
  formatCalendarDate,
  formatClockTime,
  formatTimestamp,
  isSameCalendarDay,
} from '@/lib/format/datetime';
import { formatNumber } from '@/lib/format/number';
import { formatChange } from '@/lib/format/semantic';
import type { BuildFloorInput } from '@/lib/three/build/floor';
import {
  diffVersions,
  type DiffEntry,
  type EntityKind,
  type VersionDiff,
} from '@/lib/versioning/diff';
import type { VersionEntry, VersionHistoryEntry } from '@/lib/versioning/restore';
import type { ViewerSceneFrame } from '@/screens/viewer/ViewerShell/viewerShellTypes';

import type {
  DiffCountsModel,
  DiffGroupModel,
  DiffRowModel,
  DiffTone,
  JsonDiffLineModel,
  VersionGroupModel,
  VersionRowModel,
} from './types';
import { initialsOf, RETENTION_NOTICE } from './versionHistoryGateway';

/* -------------------------------------------------------------------------- */
/* 1 — Từ vựng                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Tên tiếng Việt của bảy loại đối tượng, cho tiêu đề nhóm diff.
 *
 * Chép đúng từ `ENTITY_LABELS` của `@/lib/format/semantic:135` thay vì nhập về: bảng
 * ấy **không được xuất**. Chữ phải trùng bảng kia vì mỗi hàng trong nhóm là một câu do
 * `formatChange` sinh ra từ chính bảng ấy — hai cách gọi khác nhau cho cùng một thứ
 * trên cùng một màn là lỗi người đọc thấy ngay. Cùng tiền lệ:
 * `ViolationDetail/useViolationDetail.ts:172` và `HistoryPanel/useHistoryPanel.model.ts:129`
 * đều khai bảng của riêng chúng.
 */
const ENTITY_KIND_LABELS: Readonly<Record<EntityKind, string>> = {
  dimension: 'kích thước',
  door: 'cửa đi',
  furniture: 'nội thất',
  room: 'phòng',
  vertex: 'điểm',
  wall: 'tường',
  window: 'cửa sổ',
};

/** Thứ tự đọc ba mảng diff: thêm trước, xoá sau, thay đổi cuối — đúng `describeChanges`. */
const TONE_ORDER: readonly DiffTone[] = ['added', 'removed', 'changed'];

/** Dấu trừ toán học (U+2212), không phải dấu gạch nối của bàn phím. */
const MINUS_SIGN = '−';

/** Ngày hôm nay không đọc thành "08/09/2026" — người ta gọi nó là hôm nay. */
const TODAY_HEADING = 'hôm nay';

/* -------------------------------------------------------------------------- */
/* 2 — Ba số đếm                                                              */
/* -------------------------------------------------------------------------- */

/** Không có gì để so: ba số không, và một câu nói đúng điều đó. */
export const EMPTY_DIFF_COUNTS: DiffCountsModel = Object.freeze({
  added: 0,
  removed: 0,
  changed: 0,
  addedLabel: `+${formatNumber(0)}`,
  removedLabel: `${MINUS_SIGN}${formatNumber(0)}`,
  changedLabel: `~${formatNumber(0)}`,
  ariaLabel: 'không có thay đổi nào',
});

/**
 * Ba con số của một bản so, kèm nhãn đã định dạng.
 *
 * `ariaLabel` tồn tại vì ba chấm màu không đọc được thành lời: A4 cho đúng ba màu
 * trạng thái, và trình đọc màn hình không thấy màu nào cả.
 */
export function countsOf(diff: VersionDiff): DiffCountsModel {
  const added = diff.added.length;
  const removed = diff.removed.length;
  const changed = diff.changed.length;

  if (added === 0 && removed === 0 && changed === 0) {
    return EMPTY_DIFF_COUNTS;
  }

  return {
    added,
    removed,
    changed,
    addedLabel: `+${formatNumber(added)}`,
    removedLabel: `${MINUS_SIGN}${formatNumber(removed)}`,
    changedLabel: `~${formatNumber(changed)}`,
    ariaLabel: `thêm ${formatNumber(added)}, xoá ${formatNumber(removed)}, thay đổi ${formatNumber(changed)}`,
  };
}

/* -------------------------------------------------------------------------- */
/* 3 — Cột trái: hàng phiên bản và nhóm theo ngày                             */
/* -------------------------------------------------------------------------- */

/** Một hàng kèm mốc thời gian thô của nó — phép gộp theo ngày cần mốc, view thì không. */
export interface VersionRowBuild {
  readonly row: VersionRowModel;
  readonly createdAt: string;
}

/**
 * Ảnh chụp đầy đủ của mục đứng NGAY SAU mục thứ `index` — tức bản cũ hơn liền kề.
 *
 * Dùng để đếm "phiên bản này đã đổi gì so với bản trước nó". Bản cũ hơn chỉ còn siêu
 * dữ liệu thì không so được, và hàng ấy mang ba số không thay vì một con số bịa.
 */
function previousFullVersion(
  history: readonly VersionHistoryEntry[],
  index: number,
): VersionEntry | null {
  const previous = history[index + 1];

  return previous !== undefined && previous.kind === 'full' ? previous.version : null;
}

export interface BuildRowsContext {
  readonly history: readonly VersionHistoryEntry[];
  readonly now: Date;
  readonly leftVersionId: string | null;
  readonly rightVersionId: string | null;
}

/**
 * Lịch sử thành hàng.
 *
 * `history` là mới-nhất-trước, đúng thứ tự `appendVersionToHistory` dựng ra, nên mục
 * thứ 0 là bản hiện tại và `index + 1` là bản cũ hơn liền kề.
 */
export function buildVersionRows(context: BuildRowsContext): readonly VersionRowBuild[] {
  const { history, now, leftVersionId, rightVersionId } = context;
  const pickedCount = (leftVersionId === null ? 0 : 1) + (rightVersionId === null ? 0 : 1);

  return history.map((entry, index): VersionRowBuild => {
    const metadata = entry.version;
    const isMetadataOnly = entry.kind !== 'full';
    const isSelectedForCompare = metadata.id === leftVersionId || metadata.id === rightVersionId;
    const previous = entry.kind === 'full' ? previousFullVersion(history, index) : null;
    const counts =
      entry.kind === 'full' && previous !== null
        ? countsOf(diffVersions(previous.snapshot, entry.version.snapshot))
        : EMPTY_DIFF_COUNTS;

    return {
      createdAt: metadata.createdAt,
      row: {
        id: metadata.id,
        label: `v${formatNumber(metadata.sequence, { grouping: false })}`,
        description: metadata.note ?? 'không có ghi chú cho phiên bản này',
        authorName: metadata.creatorId,
        authorInitials: initialsOf(metadata.creatorId),
        // Không có nguồn ảnh đại diện nào ở tầng logic, nên ô đại diện dựng bằng chữ
        // cái đầu — một đường dẫn bịa ra còn tệ hơn một ô chữ thành thật (R-69).
        avatarUrl: null,
        relativeTimeLabel: formatTimestamp(metadata.createdAt, now),
        absoluteTimeLabel: `${formatCalendarDate(metadata.createdAt)} ${formatClockTime(metadata.createdAt)}`,
        counts,
        isCurrent: index === 0,
        // Không có endpoint gắn nhãn, nên không có nhãn nào để đọc ra (R-69).
        tagLabel: null,
        isMetadataOnly,
        retentionNotice: isMetadataOnly ? RETENTION_NOTICE : null,
        isSelectedForCompare,
        isPickable: !isMetadataOnly && (isSelectedForCompare || pickedCount < 2),
      },
    };
  });
}

/**
 * Gộp theo NGÀY (P-03).
 *
 * Chỉ gộp các hàng liền kề: lịch sử đã sắp mới-nhất-trước nên hai hàng cùng ngày luôn
 * đứng cạnh nhau, và gộp kiểu này giữ nguyên thứ tự thay vì sắp lại sau lưng người đọc.
 *
 * Gộp theo NGƯỜI không có ở đây vì nó không có ở đâu cả — xem `canGroupByAuthor`.
 */
export function groupRowsByDay(
  builds: readonly VersionRowBuild[],
  now: Date,
): readonly VersionGroupModel[] {
  const groups: VersionGroupModel[] = [];
  let current: { createdAt: string; rows: VersionRowModel[] } | null = null;

  for (const build of builds) {
    if (current !== null && isSameCalendarDay(current.createdAt, build.createdAt)) {
      current.rows.push(build.row);
      continue;
    }

    const heading = isSameCalendarDay(build.createdAt, now)
      ? TODAY_HEADING
      : formatCalendarDate(build.createdAt);

    current = { createdAt: build.createdAt, rows: [build.row] };
    groups.push({ id: `${heading}-${build.row.id}`, heading, rows: current.rows });
  }

  return groups;
}

/* -------------------------------------------------------------------------- */
/* 4 — Cột phải: hàng diff, nhóm diff, JSON thô                               */
/* -------------------------------------------------------------------------- */

/** Ba mảng của một `VersionDiff`, đọc theo đúng thứ tự `describeChanges` dùng. */
function entriesOf(diff: VersionDiff, tone: DiffTone): readonly DiffEntry[] {
  if (tone === 'added') {
    return diff.added;
  }

  return tone === 'removed' ? diff.removed : diff.changed;
}

/** Tiêu đề ngữ cảnh của một khối JSON — dòng không tô nền. */
function toneHeading(tone: DiffTone): string {
  if (tone === 'added') {
    return 'đã thêm';
  }

  return tone === 'removed' ? 'đã xoá' : 'đã thay đổi';
}

/**
 * Nhóm diff theo LOẠI đối tượng, mỗi hàng là một câu tiếng thường.
 *
 * Câu do `formatChange` sinh, không do màn ghép: nó là nơi duy nhất biết "dày" đi với
 * `thickness_mm` và đơn vị nào đi với con số nào (R-61).
 */
export function buildDiffGroups(diff: VersionDiff): readonly DiffGroupModel[] {
  const rowsByKind = new Map<EntityKind, DiffRowModel[]>();

  for (const tone of TONE_ORDER) {
    entriesOf(diff, tone).forEach((entry, index) => {
      const rows = rowsByKind.get(entry.entityType) ?? [];
      const ordinal = formatNumber(index, { grouping: false });

      rows.push({
        id: `${tone}-${entry.entityType}-${entry.entityId}-${entry.field ?? ''}-${ordinal}`,
        entityId: entry.entityId,
        entityType: entry.entityType,
        tone,
        sentence: formatChange(entry),
      });
      rowsByKind.set(entry.entityType, rows);
    });
  }

  const groups: DiffGroupModel[] = [];

  for (const [entityType, rows] of rowsByKind) {
    groups.push({
      entityType,
      heading: ENTITY_KIND_LABELS[entityType],
      count: rows.length,
      countLabel: `${formatNumber(rows.length)} thay đổi`,
      rows,
    });
  }

  return groups;
}

/**
 * JSON thô, MỘT dòng cho mỗi mục diff.
 *
 * Cố ý không in đẹp nhiều dòng: đặc tả đòi câu tiếng thường đứng TRƯỚC JSON thô, nên
 * tab này là chỗ tra cứu chứ không phải chỗ đọc chính, và một mục một dòng thì đối
 * chiếu được với đúng một hàng ở tab "Thay đổi".
 */
export function buildJsonLines(diff: VersionDiff): readonly JsonDiffLineModel[] {
  const lines: JsonDiffLineModel[] = [];

  for (const tone of TONE_ORDER) {
    const entries = entriesOf(diff, tone);

    if (entries.length === 0) {
      continue;
    }

    lines.push({ id: `heading-${tone}`, text: `// ${toneHeading(tone)}`, tone: null });

    entries.forEach((entry, index) => {
      lines.push({
        id: `${tone}-${formatNumber(index, { grouping: false })}`,
        text: JSON.stringify(entry),
        tone,
      });
    });
  }

  return lines;
}

/** Mã của mọi đối tượng có mặt trong bản so, không trùng, theo thứ tự gặp. */
export function changedEntityIdsOf(diff: VersionDiff): readonly string[] {
  const ids = new Set<string>();

  for (const tone of TONE_ORDER) {
    for (const entry of entriesOf(diff, tone)) {
      ids.add(entry.entityId);
    }
  }

  return [...ids];
}

/* -------------------------------------------------------------------------- */
/* 5 — Khung cảnh 3D                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Vòng quay nghỉ của khung nhìn mở đầu, tính theo vòng.
 *
 * Ba hằng camera dưới đây lặp lại `DEFAULT_CAMERA_RIG`
 * (`lib/three/present/director.ts:54`) thay vì nhập nó về, và đó là một lượt đánh đổi
 * có cân: `director.ts` nhập `three` ở dòng đầu, nên một `import` từ đây kéo cả `three`
 * vào phần gói TĨNH của tuyến lịch sử phiên bản — mà cổng kích thước gói đo theo TỪNG
 * tuyến, và cảnh 3D của màn này cố ý chỉ được nhập động lúc người dùng mở tab "Trực
 * quan". Cùng tiền lệ: `ViewerShell/useViewerShell.ts:346` cũng khai
 * `AXONOMETRIC_POLAR_RAD` của riêng nó thay vì dùng chung.
 */
const CAMERA_RESTING_TURN = 0.05;

/** Năm mươi độ, tính theo vòng: đủ dốc để đọc mặt bằng, đủ thấp để tường còn mặt. */
const CAMERA_ELEVATION_TURN = 50 / 360;

/** Khoảng trống chừa quanh mô hình sau khi khuôn hình, theo tỉ lệ bề rộng của nó. */
const CAMERA_MARGIN = 1.03;

/** Khoảng cách tối thiểu, cho một mô hình quá nhỏ để tự quyết định khuôn hình. */
const MIN_CAMERA_DISTANCE_M = 8;

/** Một phần tư vòng — góc chúc đo từ trục +Y, nên nó là mốc trừ đi độ cao camera. */
const QUARTER_TURN_RAD = RADIANS_PER_TURN / 4;

/** Bề rộng lớn nhất của các tầng, tính bằng mét; `null` khi không tầng nào có tường. */
function spanMetresOf(levels: readonly BuildFloorInput[]): number | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const level of levels) {
    for (const wall of level.walls) {
      for (const point of [wall.centreline.start, wall.centreline.end]) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return millimetresToMetres(millimetres(Math.max(maxX - minX, maxY - minY)));
}

/**
 * Khung cảnh mở đầu của tab "Trực quan".
 *
 * View mount bằng khung này rồi ghi đè đúng hai trường của mình
 * (`selectedEntityIds`, `hoveredEntityId`), nên hai trường ấy để trống ở đây. Không
 * tầng nào dựng được thì trả `null` và view hiện câu caption thay vì canvas.
 */
export function buildSceneFrame(
  levels: readonly BuildFloorInput[],
  reducedMotion: boolean,
): ViewerSceneFrame | null {
  if (levels.length === 0) {
    return null;
  }

  const span = spanMetresOf(levels);
  const framed = span === null ? 0 : span * CAMERA_MARGIN;

  return {
    azimuthRad: CAMERA_RESTING_TURN * RADIANS_PER_TURN,
    polarRad: QUARTER_TURN_RAD - CAMERA_ELEVATION_TURN * RADIANS_PER_TURN,
    distanceM: Math.max(framed, MIN_CAMERA_DISTANCE_M),
    isOrthographic: false,
    visibleStoreyIds: levels.map((level) => level.level.id),
    separation: 0,
    selectedEntityIds: [],
    hoveredEntityId: null,
    sectionPlane: null,
    isolatedEntityIds: null,
    hiddenEntityIds: [],
    reducedMotion,
  };
}
