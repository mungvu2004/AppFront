/**
 * Nửa "tính toán" của S-34 `HistoryPanel` — hàm thuần, không React, không kho.
 *
 * Mọi phép biến `HistoryStep[]` của S-06 thành `HistoryDayGroup[]` của hợp đồng
 * xảy ra ở đây, nên bài kiểm dựng được từng phép một mà không cần `renderHook`
 * và không cần một cảnh 3D. `useHistoryPanel.ts` chỉ còn việc nối kho, cổng và
 * hoạt cảnh vào những hàm này.
 *
 * ## Năm quyết định của file này, kèm lý do
 *
 * 1. **Thứ tự hiển thị là MỚI NHẤT TRƯỚC.** Ngăn xếp của S-06 xếp cũ trước
 *    (`undoSteps()` là "oldest first"), nhưng nhãn ngày của hợp đồng là `hôm
 *    nay` → `hôm qua` → ngày tháng, và một dòng thời gian mở ra ở "hôm nay" thì
 *    phải bắt đầu bằng hôm nay. {@link buildTimelineItems} đảo đúng một lần, ở
 *    đúng một chỗ, và {@link jumpOffsetOf} vẫn tính trên trục THỜI GIAN chứ
 *    không tính trên trục hiển thị.
 * 2. **Mục đã hoàn tác không bao giờ bị loại vì nó đã hoàn tác.** Vị trí
 *    (`past`/`current`/`undone`) chỉ là một nhãn; thứ duy nhất bỏ bớt mục là
 *    {@link filterTimeline}, và nó lọc theo loại việc với người thực hiện, không
 *    lọc theo vị trí. Đây là luật cốt lõi "hoàn tác không phá huỷ".
 * 3. **Không câu mô tả nào do màn này viết.** Nhãn của một mục LUÔN là
 *    `HistoryStep.label` (do `buildHistoryLabel` của S-06 sinh), nhãn của một
 *    mục con LUÔN là `Command.description` (do người viết lệnh soạn). Thứ file
 *    này ghép chỉ là nhãn ĐỊNH DANH — `tường W-000014AAAA`, `Độ dày #W-014` —
 *    đúng những chuỗi hợp đồng nêu ví dụ và đòi phải có.
 * 4. **`diffVersions` của `src/lib/versioning` KHÔNG được dùng.** Hình dạng của
 *    nó gần giống, nhưng `ChangeEntityKind` của nó là
 *    `vertex/wall/door/window/furniture/room/dimension` còn tầng lệnh dùng
 *    `level/wall/opening/furniture/room/axis/dimension`. Ba loại lệch nhau
 *    (`level`, `opening`, `axis`) sẽ bị nó bỏ qua ÂM THẦM — một bảng lịch sử
 *    thiếu mọi thay đổi ô mở mà không báo gì. Nên {@link diffOfChange} so sánh
 *    từng trường tại chỗ, trên đúng bảy loại của `EntityKind`.
 * 5. **Định dạng số xảy ra ở đây (A15).** `beforeText`/`afterText` rời file này
 *    là chuỗi đã xong, và hai đầu của một phép đo dùng CHUNG một đơn vị — chọn
 *    theo giá trị lớn hơn — để một thay đổi vượt mốc một mét không đổi đơn vị
 *    giữa câu. Kỷ luật này chép từ `sharedLengthUnit` của
 *    `src/lib/format/semantic.ts`.
 */

import type { EntityKind } from '@/domain/spatial/ids';
import type { EntityId } from '@/domain/spatial/types';
import type { SpatialEntity } from '@/domain/spatial/normalize';
import { ROOM_USAGE_LABELS } from '@/domain/rules/registry';
import type { HistoryStep } from '@/lib/commands/history';
import { FURNITURE_KIND_LABELS, WALL_KIND_LABELS } from '@/lib/commands/business/shared';
import { OPENING_KIND_LABELS } from '@/domain/openings/types';
import type { Command, EntityChange } from '@/lib/commands/types';
import {
  formatCalendarDate,
  formatClockTime,
  formatTimestamp,
  isSameCalendarDay,
} from '@/lib/format/datetime';
import {
  formatAngle,
  formatArea,
  formatLength,
  METRE_THRESHOLD_MM,
  type LengthDisplayUnit,
} from '@/lib/format/measure';
import { isFormattable } from '@/lib/format/number';

import {
  HISTORY_ANONYMOUS_ACTOR_LABEL,
  HISTORY_MAX_STEPS,
  HISTORY_SESSION_GAP_MS,
  type HistoryActor,
  type HistoryBatchItem,
  type HistoryCategory,
  type HistoryDayGroup,
  type HistoryEntityRef,
  type HistoryFilters,
  type HistoryItemPosition,
  type HistoryPanelState,
  type HistoryPartialReason,
  type HistorySessionGroup,
  type HistorySingleItem,
  type HistoryTimelineItem,
  type HistoryValueDiff,
} from './historyPanelTypes';

/* -------------------------------------------------------------------------- */
/* Hằng số của phép gộp.                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Một ngày dương lịch, tính bằng mili giây — chỉ dùng để hỏi "hôm qua là ngày nào".
 *
 * Khai tại màn theo đúng tiền lệ `MS_PER_DAY` của `hooks/useShareLinks.ts:93` và
 * `DAY_MS` của `BillingScreen/billingGateway.ts:273`: `src/lib/format/datetime`
 * giữ hằng số ngày của nó ở dạng riêng tư và không xuất ra. Con số này KHÔNG
 * phải một thời lượng chuyển động, nên nó không thuộc `MOTION_DURATIONS_MS` và
 * không đi qua thang năm giá trị của mục B.
 *
 * Nó chỉ chọn NHÃN, không chọn nhóm: phép chia ngày là `isSameCalendarDay`, thứ
 * đọc đúng múi giờ đang hiển thị.
 */
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Nhãn ngày cho hôm nay và hôm qua; xa hơn thì đọc ngày tháng đầy đủ. */
const TODAY_LABEL = 'hôm nay';
const YESTERDAY_LABEL = 'hôm qua';

/** Mở đầu nhãn phiên, ghép với giờ bắt đầu phiên: `phiên lúc 14:05`. */
const SESSION_LABEL_PREFIX = 'phiên lúc ';

/** Nhãn người thực hiện khi đó chính là người đang xem. */
const SELF_ACTOR_LABEL = 'Bạn';

/** Chữ tắt khi `actorId` không có một chữ cái hay chữ số nào để lấy. */
const UNKNOWN_INITIALS = '?';

/** Ngăn giữa mã bước và mã mục con — mục con không có id riêng ở tầng lệnh. */
const CHILD_ID_SEPARATOR = '::';

/* -------------------------------------------------------------------------- */
/* Tên tiếng Việt của bảy loại đối tượng.                                      */
/* -------------------------------------------------------------------------- */

/**
 * Tên gọi của từng loại đối tượng, đúng từ vựng `KIND_LABELS` của
 * `src/lib/commands/history.ts:149-158` dùng khi nó sinh nhãn bước.
 *
 * Chép lại vì bảng gốc là `const` riêng tư của module ấy, không xuất ra — và
 * R-68 cấm thêm file vào `src/lib` trong lúc dựng màn. Hai bảng phải khớp nhau
 * chữ một: một mục lịch sử ghi `Kéo tường W-000014AAAA` mà dòng đối tượng liên
 * quan lại ghi `vách W-000014AAAA` thì người đọc tưởng đó là hai vật.
 */
const ENTITY_KIND_LABELS: Readonly<Record<EntityKind, string>> = {
  level: 'tầng',
  wall: 'tường',
  opening: 'lỗ mở',
  furniture: 'đồ đạc',
  room: 'phòng',
  axis: 'trục',
  dimension: 'kích thước',
};

/* -------------------------------------------------------------------------- */
/* Phân loại một bước.                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Loại việc của MỘT thay đổi, đọc từ `ReviewMetadata` trên ảnh chụp `after`.
 *
 * Ba câu hỏi, theo đúng thứ tự này:
 *
 * 1. Cờ `reviewed` vừa bật từ `false` lên `true`? Đó là việc của NGƯỜI DUYỆT.
 *    Kiểm cả chiều chuyển chứ không chỉ giá trị cuối: một bức tường đã duyệt bị
 *    kéo dài ra vẫn mang `reviewed: true`, mà lượt kéo ấy không phải một lượt
 *    duyệt.
 * 2. `source === 'ai'`? Đó là đầu ra của mô hình.
 * 3. Còn lại là một lượt sửa tay.
 *
 * A5 nói đầu ra AI không bao giờ được tự đặt cờ xanh "đã xác minh"; hàm này chỉ
 * ĐỌC hai trường ấy, nó không đặt trường nào, nên nó không có đường phạm A5.
 */
export function categoryOfChange(change: EntityChange): HistoryCategory {
  const after = change.after;

  if (after === null) {
    return 'edit';
  }

  if (after.reviewed && (change.before === null || !change.before.reviewed)) {
    return 'review';
  }

  return after.source === 'ai' ? 'ai' : 'edit';
}

/** Mọi thay đổi của một bước, phẳng ra theo thứ tự lệnh rồi thứ tự thay đổi. */
export function changesOfStep(step: HistoryStep): readonly EntityChange[] {
  return step.commands.flatMap((command) => [...command.changes]);
}

/**
 * Loại việc của cả một bước, khi bước ấy gộp nhiều thay đổi khác loại.
 *
 * Thứ tự ưu tiên `review` › `ai` › `edit`, vì đó là thứ tự người đọc quan tâm:
 * "trong lô này có ai duyệt gì không" là câu hỏi trước "trong lô này có phần
 * nào máy sinh ra không".
 */
export function categoryOfStep(step: HistoryStep): HistoryCategory {
  const categories = changesOfStep(step).map(categoryOfChange);

  if (categories.includes('review')) {
    return 'review';
  }

  return categories.includes('ai') ? 'ai' : 'edit';
}

/* -------------------------------------------------------------------------- */
/* Người thực hiện.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Chữ tắt VIẾT HOA, tối đa hai ký tự, dựng từ chính `actorId`.
 *
 * **Không hiển thị được.** Viết hoa KHÔNG cứu được nó: `expectVietnamese` bỏ
 * hoa/thường trước khi so, nên `"AN"` trượt y hệt `"An"`. View đã bỏ hẳn chữ
 * tắt khỏi `Avatar`; trường này còn lại vì hợp đồng khai nó, và vì một nơi gọi
 * KHÔNG vẽ ra màn (nhật ký, xuất tệp) vẫn dùng được. Xem `historyPanelTypes.ts`.
 */
export function initialsOf(actorId: string): string {
  const parts = actorId.split(/[^0-9A-Za-z]+/u).filter((part) => part !== '');
  const first = parts[0] ?? '';
  const second = parts[1];
  const letters =
    second === undefined ? first.slice(0, 2) : `${first.slice(0, 1)}${second.slice(0, 1)}`;

  return letters === '' ? UNKNOWN_INITIALS : letters.toUpperCase();
}

/**
 * Sổ đánh số những người KHÔNG phải người đang xem.
 *
 * Dựng một lần cho cả trục thời gian, theo thứ tự gặp từ cũ tới mới, nên số của
 * một người không nhảy khi danh sách được lọc hay khi một mục được mở ra. Người
 * đang xem không có số: họ là `Bạn`.
 */
export function actorOrdinalsOf(
  steps: readonly HistoryStep[],
  currentActorId: string,
): ReadonlyMap<string, number> {
  const ordinals = new Map<string, number>();

  for (const step of steps) {
    for (const command of step.commands) {
      if (command.actorId !== currentActorId && !ordinals.has(command.actorId)) {
        ordinals.set(command.actorId, ordinals.size + 1);
      }
    }
  }

  return ordinals;
}

/**
 * Người đứng sau một mục.
 *
 * Chỉ hai câu trả lời: chính người đang xem, hoặc một `Người dùng khác` CÓ SỐ.
 * Không có câu thứ ba vì không có đường nào dựng ra nó — không bảng tra người
 * dùng theo id, không `avatarUrl` cho người khác (xem bản kê nợ #2 của
 * `historyPanelGateway.ts`), và `AuthUser.name` chỉ trả lời được "tôi là ai".
 *
 * Số thứ tự là thứ gánh việc PHÂN BIỆT, và nó gánh vì chữ tắt đã bị bỏ: view
 * không vẽ `initials` được (`expectVietnamese` đọc `"AN"` thành tiếng Việt mất
 * dấu — xem `historyPanelTypes.ts`), nên nếu ba người khác nhau cùng ra câu
 * `Người dùng khác` thì `Select` lọc theo người hiện ba dòng giống hệt nhau và
 * người dùng không chọn nổi ai. Một con số không bịa ra danh tính nào: nó chỉ
 * nói "người thứ mấy trên dòng thời gian này".
 *
 * Không có số trong sổ — người mới xuất hiện sau lượt dựng sổ — thì nhãn lùi về
 * câu trần không số. Nói ít hơn sự thật vẫn tốt hơn gắn nhầm số của người khác.
 */
export function actorOf(
  actorId: string,
  currentActorId: string,
  ordinals?: ReadonlyMap<string, number>,
): HistoryActor {
  const isSelf = actorId === currentActorId;
  const ordinal = ordinals?.get(actorId);
  const otherLabel =
    ordinal === undefined
      ? HISTORY_ANONYMOUS_ACTOR_LABEL
      : `${HISTORY_ANONYMOUS_ACTOR_LABEL} ${String(ordinal)}`;

  return {
    id: actorId,
    initials: initialsOf(actorId),
    label: isSelf ? SELF_ACTOR_LABEL : otherLabel,
    isAnonymised: !isSelf,
  };
}

/* -------------------------------------------------------------------------- */
/* Đối tượng một mục dẫn tới.                                                  */
/* -------------------------------------------------------------------------- */

/** Nhãn định danh của một đối tượng: `tường W-000014AAAA`. */
export function entityRefOf(change: EntityChange): HistoryEntityRef {
  return { id: change.id, label: `${ENTITY_KIND_LABELS[change.kind]} ${change.id}` };
}

/**
 * Mọi đối tượng một bước chạm tới, không trùng lặp, giữ thứ tự gặp đầu tiên.
 *
 * "Mọi mục phải dẫn tới được đối tượng của nó" là một trong sáu điều cấm của
 * đặc tả, nên danh sách này không bao giờ được rỗng khi bước có thay đổi.
 */
export function entityRefsOfStep(step: HistoryStep): readonly HistoryEntityRef[] {
  const seen = new Set<string>();
  const refs: HistoryEntityRef[] = [];

  for (const change of changesOfStep(step)) {
    if (seen.has(change.id)) {
      continue;
    }

    seen.add(change.id);
    refs.push(entityRefOf(change));
  }

  return refs;
}

/* -------------------------------------------------------------------------- */
/* Diff: một dòng "giá trị cũ → giá trị mới".                                  */
/* -------------------------------------------------------------------------- */

/** Hai đầu của một phép đo, đã thành chuỗi; `null` khi trường này không đọc được. */
type DiffPairFormatter = (before: unknown, after: unknown) => readonly [string, string] | null;

interface DiffField {
  /** Tên trường trên thực thể, đúng chữ như `src/domain/spatial/types.ts` viết. */
  readonly key: string;
  /** Nhãn người đọc, ví dụ `Độ dày`. */
  readonly label: string;
  readonly format: DiffPairFormatter;
}

/**
 * Đọc một trường của một thực thể mà không phải mở bảy nhánh `isEntityOfKind`.
 *
 * Ép kiểu đúng MỘT chỗ, và chỗ ấy là đây: bảng {@link DIFF_FIELDS_BY_KIND} đã
 * ghim từng tên trường theo từng loại, nên phép đọc bên dưới không bao giờ hỏi
 * một trường mà loại ấy không có — và nếu có hỏi nhầm thì giá trị là `undefined`
 * và trường bị bỏ qua, chứ không sinh ra một dòng diff sai.
 */
const fieldValue = (entity: SpatialEntity, key: string): unknown =>
  (entity as unknown as Readonly<Record<string, unknown>>)[key];

/**
 * Đơn vị chung cho hai đầu một phép đo chiều dài.
 *
 * Chọn theo giá trị lớn hơn, đúng `sharedLengthUnit` của `lib/format/semantic`:
 * `900 mm → 1,10 m` đọc như hai đại lượng khác nhau, `0,90 m → 1,10 m` thì không.
 */
const sharedLengthUnit = (before: number, after: number): LengthDisplayUnit =>
  Math.max(Math.abs(before), Math.abs(after)) < METRE_THRESHOLD_MM ? 'mm' : 'm';

/** Hai số hữu hạn, hoặc `null` khi một trong hai không phải số đọc được. */
const numberPair = (before: unknown, after: unknown): readonly [number, number] | null => {
  const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && isFormattable(value);

  return isNumber(before) && isNumber(after) ? [before, after] : null;
};

const lengthPair: DiffPairFormatter = (before, after) => {
  const pair = numberPair(before, after);

  if (pair === null) {
    return null;
  }

  const unit = sharedLengthUnit(pair[0], pair[1]);

  return [formatLength(pair[0], { unit }), formatLength(pair[1], { unit })];
};

const areaPair: DiffPairFormatter = (before, after) => {
  const pair = numberPair(before, after);

  return pair === null ? null : [formatArea(pair[0]), formatArea(pair[1])];
};

const anglePair: DiffPairFormatter = (before, after) => {
  const pair = numberPair(before, after);

  return pair === null ? null : [formatAngle(pair[0]), formatAngle(pair[1])];
};

/** Chuỗi người dùng tự gõ — tên phòng, nhãn trục. Không định dạng lại. */
const textPair: DiffPairFormatter = (before, after) =>
  typeof before === 'string' && typeof after === 'string' ? [before, after] : null;

/** Một giá trị liệt kê, tra sang tiếng Việt bằng bảng nhãn dùng chung của repo. */
const enumPair =
  (labels: Readonly<Record<string, string>>): DiffPairFormatter =>
  (before, after) => {
    if (typeof before !== 'string' || typeof after !== 'string') {
      return null;
    }

    const beforeLabel = labels[before];
    const afterLabel = labels[after];

    return beforeLabel === undefined || afterLabel === undefined
      ? null
      : [beforeLabel, afterLabel];
  };

/**
 * Những trường đáng một dòng diff, theo từng loại đối tượng, theo thứ tự đọc.
 *
 * Trường vắng mặt ở đây vẫn thay đổi bình thường — chỉ là mục không hiện một
 * dòng "cũ → mới" cho nó. Đó là chủ ý: hình học (đường tim tường, đường bao
 * phòng, hộp bao nội thất) là một mảng điểm, và ép nó thành một dòng chữ thì
 * dòng ấy không nói gì hơn nhãn của chính bước đã nói. Các bảng nhãn liệt kê
 * đều mượn nguyên của repo, không bảng nào gõ lại ở đây (R-71).
 */
const DIFF_FIELDS_BY_KIND: Readonly<Record<EntityKind, readonly DiffField[]>> = {
  level: [
    { key: 'elevationMm', label: 'Cao độ', format: lengthPair },
    { key: 'heightMm', label: 'Chiều cao tầng', format: lengthPair },
    { key: 'areaM2', label: 'Diện tích sàn', format: areaPair },
    { key: 'name', label: 'Tên tầng', format: textPair },
  ],
  wall: [
    { key: 'thicknessMm', label: 'Độ dày', format: lengthPair },
    { key: 'heightMm', label: 'Chiều cao', format: lengthPair },
    { key: 'kind', label: 'Loại tường', format: enumPair(WALL_KIND_LABELS) },
  ],
  opening: [
    { key: 'widthMm', label: 'Chiều rộng', format: lengthPair },
    { key: 'heightMm', label: 'Chiều cao', format: lengthPair },
    { key: 'sillHeightMm', label: 'Cao bậu', format: lengthPair },
    { key: 'offsetMm', label: 'Vị trí trên tường', format: lengthPair },
    { key: 'kind', label: 'Loại ô mở', format: enumPair(OPENING_KIND_LABELS) },
  ],
  furniture: [
    { key: 'rotationDeg', label: 'Góc xoay', format: anglePair },
    { key: 'kind', label: 'Loại đồ đạc', format: enumPair(FURNITURE_KIND_LABELS) },
  ],
  room: [
    { key: 'areaM2', label: 'Diện tích', format: areaPair },
    { key: 'name', label: 'Tên phòng', format: textPair },
    { key: 'usage', label: 'Công năng', format: enumPair(ROOM_USAGE_LABELS) },
  ],
  axis: [{ key: 'label', label: 'Nhãn trục', format: textPair }],
  dimension: [
    { key: 'valueMm', label: 'Trị số đo', format: lengthPair },
    { key: 'overrideValueMm', label: 'Trị số ghi đè', format: lengthPair },
  ],
};

/**
 * Dòng "cũ → mới" của một thay đổi, hoặc `null` khi bước này không đổi giá trị nào.
 *
 * Lấy trường ĐẦU TIÊN có thật hai đầu và hai đầu khác nhau, theo thứ tự đã ghim
 * trong {@link DIFF_FIELDS_BY_KIND}. Một dòng chứ không phải mọi dòng: mục là
 * một hàng trong danh sách, và hợp đồng cho nó đúng một `HistoryValueDiff`.
 *
 * Thêm/xoá một đối tượng (`before` hoặc `after` là `null`) không có dòng diff —
 * nhãn của bước đã nói `Thêm …`/`Xoá …` rồi, và một dòng `(trống) → 220 mm`
 * chỉ lặp lại điều đó bằng ký hiệu.
 */
export function diffOfChange(change: EntityChange): HistoryValueDiff | null {
  const before = change.before;
  const after = change.after;

  if (before === null || after === null) {
    return null;
  }

  for (const field of DIFF_FIELDS_BY_KIND[change.kind]) {
    const beforeValue = fieldValue(before, field.key);
    const afterValue = fieldValue(after, field.key);

    if (Object.is(beforeValue, afterValue)) {
      continue;
    }

    const pair = field.format(beforeValue, afterValue);

    if (pair !== null && pair[0] !== pair[1]) {
      return { fieldLabel: `${field.label} #${change.id}`, beforeText: pair[0], afterText: pair[1] };
    }
  }

  return null;
}

/** Dòng diff đầu tiên tìm được trong cả một bước, hoặc `null`. */
export function diffOfStep(step: HistoryStep): HistoryValueDiff | null {
  for (const change of changesOfStep(step)) {
    const diff = diffOfChange(change);

    if (diff !== null) {
      return diff;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Một bước thành một mục.                                                     */
/* -------------------------------------------------------------------------- */

/** Mã của mục con thứ `changeIndex` trong lệnh thứ `commandIndex` của một bước. */
export function childItemId(stepId: string, commandIndex: number, changeIndex: number): string {
  return [stepId, commandIndex, changeIndex].join(CHILD_ID_SEPARATOR);
}

/**
 * Mã BƯỚC của một mục, dù mục ấy là mục cha hay mục con.
 *
 * Bấm vào một mục con là nhảy về đúng bước chứa nó: tầng lệnh không nhảy được
 * vào giữa một lô — `runTransaction` sinh MỘT `UndoEntry` cho cả lô, và một lần
 * `Ctrl+Z` trả về nguyên lô. Nói dối chuyện đó bằng một nút nhảy riêng cho mục
 * con sẽ là một lời hứa tầng dưới không giữ được.
 */
export function stepIdOfItem(itemId: string): string {
  const cut = itemId.indexOf(CHILD_ID_SEPARATOR);

  return cut === -1 ? itemId : itemId.slice(0, cut);
}

interface ItemContext {
  readonly currentActorId: string;
  readonly nowMs: number;
  readonly timeZone?: string | undefined;
  /** Sổ đánh số người khác, dựng một lần cho cả trục — xem {@link actorOrdinalsOf}. */
  readonly actorOrdinals?: ReadonlyMap<string, number> | undefined;
}

/** Thời gian tương đối đã định dạng bằng P-02: `12 phút trước`, `14:32`. */
const relativeLabelOf = (timestampIso: string, context: ItemContext): string =>
  formatTimestamp(
    new Date(timestampIso),
    context.nowMs,
    context.timeZone === undefined ? {} : { timeZone: context.timeZone },
  );

/** Một mục con: đúng một thay đổi của đúng một lệnh trong lô. */
function childItemOf(
  step: HistoryStep,
  command: Command,
  commandIndex: number,
  change: EntityChange,
  changeIndex: number,
  position: HistoryItemPosition,
  context: ItemContext,
): HistorySingleItem {
  return {
    kind: 'single',
    id: childItemId(step.id, commandIndex, changeIndex),
    /* Câu của người viết lệnh, không phải câu do màn ghép. */
    label: command.description,
    category: categoryOfChange(change),
    actor: actorOf(command.actorId, context.currentActorId, context.actorOrdinals),
    timestampIso: command.timestamp,
    relativeLabel: relativeLabelOf(command.timestamp, context),
    position,
    entityRefs: [entityRefOf(change)],
    diff: diffOfChange(change),
  };
}

/** Mọi mục con của một bước, phẳng theo thứ tự lệnh rồi thứ tự thay đổi. */
function childrenOf(
  step: HistoryStep,
  position: HistoryItemPosition,
  context: ItemContext,
): readonly HistorySingleItem[] {
  return step.commands.flatMap((command, commandIndex) =>
    command.changes.map((change, changeIndex) =>
      childItemOf(step, command, commandIndex, change, changeIndex, position, context),
    ),
  );
}

/**
 * Bước này là một lô hay một bước đơn.
 *
 * Hai nguồn sinh ra lô, và cả hai đều đếm được từ chính `HistoryStep`:
 * `runTransaction` để lại nhiều `commands`, còn `mergeCommands` gộp một mạch
 * kéo để lại nhiều `entryIds`. Không nguồn nào khác sinh ra lô.
 */
export function isBatchStep(step: HistoryStep): boolean {
  return step.commands.length > 1 || step.entryIds.length > 1;
}

/** Một bước của S-06 thành một mục của hợp đồng. */
export function timelineItemOf(
  step: HistoryStep,
  position: HistoryItemPosition,
  isExpanded: boolean,
  context: ItemContext,
): HistoryTimelineItem {
  const base = {
    id: step.id,
    /* Nhãn LẤY TỪ `HistoryStep.label`, do `buildHistoryLabel` sinh (S-06). */
    label: step.label,
    category: categoryOfStep(step),
    actor: actorOf(
      step.commands[0]?.actorId ?? context.currentActorId,
      context.currentActorId,
      context.actorOrdinals,
    ),
    timestampIso: step.timestamp,
    relativeLabel: relativeLabelOf(step.timestamp, context),
    position,
    entityRefs: entityRefsOfStep(step),
  };

  if (!isBatchStep(step)) {
    return { ...base, kind: 'single', diff: diffOfStep(step) } satisfies HistorySingleItem;
  }

  return {
    ...base,
    kind: 'batch',
    children: childrenOf(step, position, context),
    isExpanded,
  } satisfies HistoryBatchItem;
}

/* -------------------------------------------------------------------------- */
/* Dòng thời gian.                                                             */
/* -------------------------------------------------------------------------- */

export interface BuildTimelineInput {
  /** `undoSteps()` của S-06 — cũ trước, mục trên cùng là vị trí hiện tại. */
  readonly undoSteps: readonly HistoryStep[];
  /** `redoSteps()` của S-06 — bước kế tiếp trước, tất cả đều đã hoàn tác. */
  readonly redoSteps: readonly HistoryStep[];
  readonly currentActorId: string;
  readonly nowMs: number;
  /** Mã những lô đang mở. Lô không có trong tập này thì thu gọn. */
  readonly expandedIds: ReadonlySet<string>;
  readonly timeZone?: string | undefined;
}

/**
 * Hai ngăn xếp của S-06 nối lại thành một trục thời gian TĂNG DẦN.
 *
 * `undoSteps()` là cũ→mới; `redoSteps()` cũng là cũ→mới và bắt đầu ngay sau
 * bước hiện tại (`redo()` lấy phần tử cuối của mảng gốc, nên bản đảo mà
 * `redoSteps()` trả về đặt "bước kế tiếp" ở đầu). Nối thẳng hai mảng là đúng
 * thứ tự thời gian, không cần sắp lại lần nào.
 */
export function chronologicalSteps(input: {
  readonly undoSteps: readonly HistoryStep[];
  readonly redoSteps: readonly HistoryStep[];
}): readonly HistoryStep[] {
  return [...input.undoSteps, ...input.redoSteps];
}

/** Vị trí của bước thứ `index` trên trục thời gian, so với vị trí hiện tại. */
export function positionAt(index: number, undoCount: number): HistoryItemPosition {
  if (index < undoCount - 1) {
    return 'past';
  }

  return index === undoCount - 1 ? 'current' : 'undone';
}

/**
 * Toàn bộ dòng thời gian, MỚI NHẤT TRƯỚC.
 *
 * Mục đã hoàn tác nằm ở đầu danh sách và KHÔNG bị bỏ đi — chúng là tương lai mà
 * người dùng vừa lùi khỏi, và luật cốt lõi nói hoàn tác không phá huỷ.
 */
export function buildTimelineItems(input: BuildTimelineInput): readonly HistoryTimelineItem[] {
  const steps = chronologicalSteps(input);
  const undoCount = input.undoSteps.length;
  const context: ItemContext = {
    currentActorId: input.currentActorId,
    nowMs: input.nowMs,
    timeZone: input.timeZone,
    /* Đánh số theo TRỤC THỜI GIAN, không theo danh sách đã lọc: số của một
       người phải đứng yên khi người dùng đổi chip loại việc. */
    actorOrdinals: actorOrdinalsOf(steps, input.currentActorId),
  };

  return steps
    .map((step, index) =>
      timelineItemOf(step, positionAt(index, undoCount), input.expandedIds.has(step.id), context),
    )
    .reverse();
}

/** Mã của mục ứng với vị trí hiện tại, hoặc `null` khi lịch sử rỗng. */
export function currentItemIdOf(items: readonly HistoryTimelineItem[]): string | null {
  return items.find((item) => item.position === 'current')?.id ?? null;
}

/**
 * Bao nhiêu bước phải lùi (âm) hay tiến (dương) để tới mục này.
 *
 * `null` khi mục không còn trên dòng thời gian — lịch sử vừa đổi dưới chân
 * người dùng, và bấm bừa vào một mã cũ sẽ lùi nhầm chỗ.
 */
export function jumpOffsetOf(input: {
  readonly undoSteps: readonly HistoryStep[];
  readonly redoSteps: readonly HistoryStep[];
  readonly itemId: string;
}): number | null {
  const stepId = stepIdOfItem(input.itemId);
  const steps = chronologicalSteps(input);
  const target = steps.findIndex((step) => step.id === stepId);

  return target === -1 ? null : target - (input.undoSteps.length - 1);
}

/* -------------------------------------------------------------------------- */
/* Bộ lọc.                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Lọc theo loại việc và theo người.
 *
 * Vị trí KHÔNG phải một tiêu chí lọc: một mục đã hoàn tác đi qua bộ lọc y hệt
 * một mục chưa hoàn tác, và nó chỉ vắng mặt khi chính người dùng chọn một chip
 * loại khác hoặc một người khác.
 */
export function filterTimeline(
  items: readonly HistoryTimelineItem[],
  filters: HistoryFilters,
): readonly HistoryTimelineItem[] {
  return items.filter((item) => {
    if (filters.category !== 'all' && item.category !== filters.category) {
      return false;
    }

    return filters.actorId === null || item.actor.id === filters.actorId;
  });
}

/** Những người có mặt trên dòng thời gian, không trùng, giữ thứ tự gặp đầu tiên. */
export function peopleOf(items: readonly HistoryTimelineItem[]): readonly HistoryActor[] {
  const byId = new Map<string, HistoryActor>();

  for (const item of items) {
    if (!byId.has(item.actor.id)) {
      byId.set(item.actor.id, item.actor);
    }
  }

  return [...byId.values()];
}

/* -------------------------------------------------------------------------- */
/* Gộp ngày → phiên.                                                           */
/* -------------------------------------------------------------------------- */

/** Nhãn của một ngày: `hôm nay`, `hôm qua`, hoặc `12/08/2026`. */
export function dayLabelOf(timestampIso: string, nowMs: number, timeZone?: string): string {
  const at = new Date(timestampIso);

  if (isSameCalendarDay(at, nowMs, timeZone)) {
    return TODAY_LABEL;
  }

  if (isSameCalendarDay(at, nowMs - MILLISECONDS_PER_DAY, timeZone)) {
    return YESTERDAY_LABEL;
  }

  return formatCalendarDate(at, timeZone === undefined ? {} : { timeZone });
}

/** Thời điểm của một mục, tính bằng mili giây; `NaN` không lọt ra ngoài hàm này. */
const epochOf = (item: HistoryTimelineItem): number => {
  const ms = new Date(item.timestampIso).getTime();

  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Cắt một ngày thành các phiên làm việc.
 *
 * Hai mục liền nhau cách nhau quá {@link HISTORY_SESSION_GAP_MS} thì thuộc hai
 * phiên. Danh sách đi vào là MỚI NHẤT TRƯỚC, nên "mục cuối của một phiên" là
 * mục sớm nhất của phiên ấy — và đó là mục cho nhãn `phiên lúc 14:05`, vì một
 * phiên được gọi tên theo lúc nó bắt đầu.
 */
export function splitIntoSessions(
  dayId: string,
  items: readonly HistoryTimelineItem[],
  timeZone?: string,
): readonly HistorySessionGroup[] {
  const sessions: HistoryTimelineItem[][] = [];

  for (const item of items) {
    const open = sessions[sessions.length - 1];
    const previous = open?.[open.length - 1];

    if (open === undefined || previous === undefined) {
      sessions.push([item]);
      continue;
    }

    if (epochOf(previous) - epochOf(item) > HISTORY_SESSION_GAP_MS) {
      sessions.push([item]);
      continue;
    }

    open.push(item);
  }

  return sessions.map((group, index) => {
    const earliest = group[group.length - 1];

    return {
      id: `${dayId}-${String(index)}`,
      label:
        earliest === undefined
          ? SESSION_LABEL_PREFIX
          : `${SESSION_LABEL_PREFIX}${formatClockTime(
              new Date(earliest.timestampIso),
              timeZone === undefined ? {} : { timeZone },
            )}`,
      items: group,
    };
  });
}

/**
 * Dòng thời gian thành `ngày → phiên → mục`.
 *
 * Phép chia ngày là `isSameCalendarDay` của P-02, không phải một phép chia cho
 * 86.400.000: 23:50 và 00:10 cách nhau hai mươi phút mà là hai ngày khác nhau,
 * và chỉ một hàm biết múi giờ mới trả lời đúng chuyện đó.
 */
export function groupTimeline(
  items: readonly HistoryTimelineItem[],
  nowMs: number,
  timeZone?: string,
): readonly HistoryDayGroup[] {
  const days: HistoryTimelineItem[][] = [];

  for (const item of items) {
    const open = days[days.length - 1];
    const previous = open?.[open.length - 1];

    if (open === undefined || previous === undefined) {
      days.push([item]);
      continue;
    }

    if (isSameCalendarDay(new Date(previous.timestampIso), new Date(item.timestampIso), timeZone)) {
      open.push(item);
      continue;
    }

    days.push([item]);
  }

  return days.flatMap((group, index) => {
    const first = group[0];

    if (first === undefined) {
      return [];
    }

    const id = `history-day-${String(index)}`;

    return [
      {
        id,
        label: dayLabelOf(first.timestampIso, nowMs, timeZone),
        sessions: splitIntoSessions(id, group, timeZone),
      },
    ];
  });
}

/** Tổng số mục còn nhìn thấy, kể cả mục đã hoàn tác; mục con không đếm hai lần. */
export function visibleCountOf(groups: readonly HistoryDayGroup[]): number {
  return groups.reduce(
    (total, day) =>
      total + day.sessions.reduce((count, session) => count + session.items.length, 0),
    0,
  );
}

/** Mọi mã đối tượng một mục dẫn tới — thứ `frameEntities` nhận (R-07). */
export function entityIdsOf(item: HistoryTimelineItem): readonly EntityId[] {
  return item.entityRefs.map((ref) => ref.id as EntityId);
}

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11).                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Vì sao danh sách chỉ có một phần.
 *
 * Chỉ một lối vào dựng được: chạm trần 100 bước, nghĩa là bước cũ nhất sắp rơi
 * khỏi đáy. Lối thứ hai của hợp đồng — `'archived'` — cần một kho lịch sử cũ
 * mà hệ thống chưa có (bản kê nợ #3 của `historyPanelGateway.ts`), nên nó không
 * bao giờ được trả về ở đây: một nút "Tải thêm" không tải được gì là đúng thứ
 * R-69 gọi là bản tạm.
 */
export function partialReasonOf(stepCount: number): HistoryPartialReason | null {
  return stepCount >= HISTORY_MAX_STEPS ? 'at-step-limit' : null;
}

/**
 * Bảy trạng thái, suy ra từ dữ liệu THẬT — hàm thuần, kiểm được không cần hook.
 *
 * Thứ tự các nhánh chép đúng `deriveRoomAreaScreenState` của màn anh em S-33:
 * vai chỉ xem đi trước vì một người xem thu gọn panel vẫn là một người xem;
 * `error` đi trước `loading` vì một lượt đã hỏng thì không còn "đang tải" nữa;
 * `collapsed` đi sau `empty` vì thu gọn một danh sách rỗng thì thứ cần nói vẫn
 * là "chưa có bước nào".
 *
 * KHÔNG một `useState` nào đứng thay cho "đang tải" (R-64): `rolesKnown` là
 * "phiên đăng nhập đã trả lời chưa", một sự thật đọc thẳng từ `useSession()`.
 * Lịch sử hoàn toàn cục bộ nên không có lượt đọc mạng nào để `useQuery` theo dõi.
 */
export function deriveHistoryPanelState(input: {
  readonly rolesKnown: boolean;
  readonly canJump: boolean;
  readonly hasFailure: boolean;
  readonly isCollapsed: boolean;
  readonly visibleCount: number;
  readonly partialReason: HistoryPartialReason | null;
}): HistoryPanelState {
  if (input.rolesKnown && !input.canJump) {
    return 'forbidden';
  }

  if (input.hasFailure) {
    return 'error';
  }

  if (!input.rolesKnown) {
    return 'loading';
  }

  if (input.visibleCount === 0) {
    return 'empty';
  }

  if (input.isCollapsed) {
    return 'collapsed';
  }

  return input.partialReason === null ? 'success' : 'partial';
}

/* -------------------------------------------------------------------------- */
/* Bóng ma trạng thái trước.                                                   */
/* -------------------------------------------------------------------------- */

/** Ảnh chụp `before` của một đối tượng, đúng thứ `previewEdit` nhận. */
export interface HistoryBeforeSnapshot {
  readonly entityId: EntityId;
  readonly entity: SpatialEntity;
}

/**
 * Ảnh chụp TRƯỚC của bước này, để vẽ bóng ma khi trỏ chuột vào mục.
 *
 * Lấy thay đổi đầu tiên còn giữ được `before` — một lượt THÊM đối tượng thì
 * `before` là `null` và không có trạng thái trước nào để vẽ, đó là sự thật chứ
 * không phải một thiếu sót. `previewEdit` nhận CẢ đối tượng như nó từng trông,
 * nên ảnh chụp đi thẳng vào đó, không phải nắn lại hình dạng lần nào.
 */
export function beforeSnapshotOf(step: HistoryStep): HistoryBeforeSnapshot | null {
  for (const change of changesOfStep(step)) {
    if (change.before !== null) {
      return { entityId: change.id, entity: change.before };
    }
  }

  return null;
}

/** Bước mang mã này, dù mã đi vào là mã của một mục con. */
export function stepOfItem(
  steps: readonly HistoryStep[],
  itemId: string,
): HistoryStep | null {
  const stepId = stepIdOfItem(itemId);

  return steps.find((step) => step.id === stepId) ?? null;
}
