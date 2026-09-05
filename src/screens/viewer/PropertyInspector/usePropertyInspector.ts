/**
 * Nửa "suy nghĩ" của `PropertyInspector` — panel phải 344px của `Viewer3D`, hiện
 * khi có đối tượng được chọn.
 *
 * View của panel thuần và kiểm được chỉ từ props (mục D của CLAUDE.md): mọi lượt
 * đọc, mọi lượt ghi, mọi con số thành chuỗi xảy ra ở đây hoặc ở
 * `propertyInspectorGateway.ts`, không ở view.
 *
 * ## R-61 — hook NỐI LẠI LOGIC ĐÃ CÓ, không chứa công thức tự chế
 *
 * - Chiều dài tường, chu vi phòng, mọi con số đọc-mà-không-sửa lấy từ
 *   `toWallViewModel`/`toOpeningViewModel`/`toRoomViewModel`
 *   (`src/lib/viewmodel/toViewModel.ts`) — hook KHÔNG đo lại một đoạn thẳng nào.
 * - Con số của ô SỬA ĐƯỢC đi qua `formatNumber`/`parseNumber` của
 *   `src/lib/format/number`, luôn theo milimét và KHÔNG tự đổi sang mét. Lý do
 *   nằm ở chính `lengthAttribute` của viewmodel: nó tự đổi sang mét từ 1000 mm
 *   (`formatLength(4250) === "4,25 m"`), nên một ô nhập dùng nó sẽ hiện "2,20"
 *   rồi đọc lại thành 2,2 mm — sai một nghìn lần. Ô sửa được vì thế hiện mm và
 *   đọc lại mm, còn dòng chỉ đọc thì giữ nguyên chữ của viewmodel.
 * - Nhãn công năng phòng lấy `ROOM_USAGE_LABELS` (`@/domain/rules/registry`),
 *   nhãn loại nội thất lấy `FURNITURE_KIND_LABELS`
 *   (`@/lib/commands/business/shared`). Không bảng nhãn nào được gõ lại ở đây trừ
 *   những chuỗi hợp đồng T4 sở hữu.
 *
 * ## Bảy việc file này chịu trách nhiệm
 *
 * 1. **Đọc theo id (D-12) và chọn nhiều.** `readInspectableEntity` tra thẳng
 *    `byId`; chọn nhiều thì mỗi id dựng một bộ dòng rồi GIAO lại với nhau:
 *    thuộc tính lệch giá trị thành `{ kind: 'mixed' }`, thuộc tính không tồn tại ở
 *    một đối tượng thành `{ kind: 'unavailable' }`. Không bao giờ có một giá trị
 *    đơn gây hiểu nhầm (CẤM TUYỆT ĐỐI số 4) — kiểu `PropertyValue` khiến điều đó
 *    thành lỗi biên dịch chứ không phải một quy ước phải nhớ.
 * 2. **Trạng thái tải và lỗi đến từ `@tanstack/react-query` (R-64).** Không một
 *    `useState` nào giữ "đang tải" hay "hỏng": `spatialQuery.isPending` và
 *    `spatialQuery.isError` là nguồn duy nhất, và `spatialQuery.refetch` chính là
 *    nút "Thử lại" của dòng lỗi.
 * 3. **Mọi lượt ghi là LỆNH (S-07) đi qua `dispatch` (S-05).** Hook không gọi
 *    `set()` (A10) và không import `commit` — `commit` chỉ sống trong cổng, bên
 *    trong `SpatialPort.applyPatches`.
 * 4. **Gộp lệnh khi kéo (D-06).** Ngăn xếp hoàn tác dựng với `MERGE_WINDOW_MS`
 *    của `src/lib/commands/mergeCommands`; hook cũng dùng ĐÚNG hằng số đó làm cửa
 *    sổ chờ trước khi phát lệnh. Con số 400 không xuất hiện trong file này (R-71).
 * 5. **Kiểm tra sau khi đổi (M-04/M-08/M-12).** `dispatch` tự chạy lại bộ luật ở
 *    bước 4 của nó; hook đọc `selectViolations` rồi lọc theo id đối tượng đang
 *    xem và gắn cảnh báo VÀO ĐÚNG DÒNG gây ra nó. Hook KHÔNG tự tính lại hình học
 *    và KHÔNG tự kiểm luật.
 * 6. **Tự lưu (D-07) và chỉ báo (D-08).** `useAutosave` giữ bộ đếm 800 ms của A7 —
 *    hằng số nằm trong chính hook đó, không viết lại ở đây. Không có nút Lưu (A7).
 * 7. **Bảy trạng thái (A11/R-63).** {@link derivePropertyInspectorState} là một hàm
 *    thuần, kiểm được không cần dựng hook, và nó là nơi DUY NHẤT quyết định trạng
 *    thái — không có nhánh hiển thị rời rạc nào ở nơi khác.
 *
 * ## Nợ kỹ thuật đã ghi nhận (không phải chuyện bỏ quên)
 *
 * - **KHÔNG có xem trước 3D trong lúc kéo.** Hợp đồng T2 mục C5 kết luận
 *   `NOT FOUND` với bốn bằng chứng độc lập: `draftSlice` không ai sản xuất trong
 *   production và bị `local/no-draft-write-outside-commands` khoá ngoài
 *   `src/store`; không nơi nào đọc `draftOperations` để vẽ lại; `handle.update`
 *   không nhận hình học nên đổi `spatial` ép dựng lại toàn cảnh qua worker;
 *   `DragPreview` chỉ phục vụ gizmo trong khung nhìn 3D. Điều phối viên và người
 *   dùng đã chốt: trong lúc kéo panel CHỈ đổi con số hiện trong panel, và lệnh
 *   phát đúng một lần khi giá trị ngừng đổi (cửa sổ {@link MERGE_WINDOW_MS}). Mô
 *   hình 3D vì thế chỉ đổi SAU lượt ghi — đó là độ trễ có thật của kiến trúc hiện
 *   nay, không phải lựa chọn của đặc tả.
 * - **Chiều cao tường và kích thước bao nội thất chỉ đọc.** Không lệnh nào ghi
 *   được hai trường đó (xem docblock của cổng).
 * - **`isInterior` suy từ `kind`, không sửa được.** Domain không có trường riêng,
 *   và cho một toggle ghi đè `kind` sẽ biến một tường chịu lực thành vách ngăn mà
 *   không có đường quay lại.
 * - **Bộ luật dùng chung chỉ đăng ký 8 luật gốc**, nên `FURNITURE-CLASH` và các
 *   luật hình học/công năng/fit-out không bao giờ hiện ở nhóm "Kiểm tra". Panel
 *   giữ nguyên: tự đăng ký thêm luật là tự kiểm luật.
 * - **Chọn nhiều là CHỈ ĐỌC.** Tầng lệnh không có lệnh nào nhận nhiều thực thể
 *   (mọi `Input` của `src/lib/commands/business` mang đúng một id), nên panel đọc
 *   giao của các thuộc tính và không mở ô nhập nào.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ROOM_USAGE_LABELS } from '@/domain/rules/registry';
import type { Violation } from '@/domain/rules/registry';
import { readEntity } from '@/domain/spatial/applyPatch';
import { isEntityOfKind } from '@/domain/spatial/normalize';
import type { NormalizedSpatial } from '@/domain/spatial/normalize';
import type {
  Furniture,
  Opening,
  Point,
  Room,
  RoomUsage,
  SwingDirection,
  Wall,
  WallKind,
} from '@/domain/spatial/types';
import { useAutosave } from '@/hooks/useAutosave';
import { useCommitFlash } from '@/hooks/useCommitFlash';
import {
  createChangeWallKindCommand,
  createChangeWallThicknessCommand,
} from '@/lib/commands/business/wallCommands';
import {
  createResizeOpeningCommand,
  createRotateFurnitureCommand,
} from '@/lib/commands/business/openingCommands';
import {
  createChangeRoomUsageCommand,
  createRenameRoomCommand,
} from '@/lib/commands/business/roomFloorCommands';
import { FURNITURE_KIND_LABELS } from '@/lib/commands/business/shared';
import type { CommandContext, CommandResult } from '@/lib/commands/business/shared';
import { MERGE_WINDOW_MS } from '@/lib/commands/mergeCommands';
import { formatNumber, formatPercent, isFormattable, MISSING_VALUE, parseNumber } from '@/lib/format/number';
import { queryKeys } from '@/lib/query/queryKeys';
import type { ViewAttribute } from '@/lib/viewmodel/types';
import { toRoomViewModel, toWallViewModel } from '@/lib/viewmodel/toViewModel';
import { useStore } from '@/store';
import { selectViolations } from '@/store/selectors';

import type {
  InspectableEntity,
  PropertyInspectorDispatchBundle,
  PropertyInspectorGateway,
} from './propertyInspectorGateway';
import {
  approvedCountOf,
  buildApproveCommand,
  buildChangeSwingCommand,
  createPropertyInspectorDispatchDeps,
  createPropertyInspectorGateway,
  nextUnapprovedIdOf,
  objectKindOf,
  readInspectableEntity,
  roomOpeningCountsOf,
  runInspectorCommand,
  violationsOfEntity,
} from './propertyInspectorGateway';
import type {
  ObjectKind,
  PropertyGroup,
  PropertyGroupId,
  PropertyInspectorState,
  PropertyRow,
  PropertyRowOption,
  PropertyStatusBadge,
  PropertyValue,
  UsePropertyInspectorOptions,
  UsePropertyInspectorResult,
} from './propertyInspectorTypes';
import {
  COLLAPSIBLE_GROUP_ID,
  OBJECT_KIND_LABELS,
  PROPERTY_GROUP_IDS,
  PROPERTY_GROUP_LABELS,
} from './propertyInspectorTypes';

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt — hợp đồng T4 sở hữu chữ, hook chỉ đặt chúng đúng chỗ.      */
/* -------------------------------------------------------------------------- */

/**
 * Chữ của panel, chép đúng theo `propertyInspector.*` trong `src/i18n/vi.json`.
 *
 * `vi.json` là TỪ ĐIỂN KIỂM TRA của `expectVietnamese`, không phải bảng dịch lúc
 * chạy (CLAUDE.md), nên nơi thật sự tạo ra chuỗi là file này.
 *
 * XUẤT KHẨU vì bài kiểm và file story của panel phải đối chiếu ĐÚNG chuỗi này
 * chứ không gõ lại một bản thứ hai bên cạnh: một bài kiểm chép lại chữ của mã
 * nguồn thì nó chỉ kiểm rằng hai bản chép giống nhau (R-70).
 */
export const PROPERTY_INSPECTOR_TEXT = {
  objectKind: OBJECT_KIND_LABELS,
  fields: {
    wall: {
      thickness: 'Độ dày',
      length: 'Chiều dài',
      height: 'Chiều cao',
      wallType: 'Loại tường',
      isInterior: 'Tường nội thất',
      openingCount: 'Số ô mở',
    },
    opening: {
      width: 'Chiều rộng',
      height: 'Chiều cao',
      sillHeight: 'Cao độ bậu',
      swingDirection: 'Chiều mở',
      hostWallId: 'Tường chủ',
    },
    furniture: {
      boundingSize: 'Kích thước bao',
      rotation: 'Góc xoay',
      furnitureKind: 'Loại nội thất',
      roomId: 'Phòng chứa',
    },
    room: {
      name: 'Tên',
      function: 'Công năng',
      area: 'Diện tích',
      doorCount: 'Số cửa',
      windowCount: 'Số cửa sổ',
    },
    advanced: {
      zOffset: 'Lệch Z',
      startPoint: 'Toạ độ đầu',
      endPoint: 'Toạ độ cuối',
      sourceEntityId: 'Mã đối tượng gốc',
      confidence: 'Độ tin cậy',
    },
  },
  wallType: {
    loadBearing: 'Chịu lực',
    partition: 'Ngăn',
    envelope: 'Bao che',
  },
  swing: {
    left: 'Mở trái',
    right: 'Mở phải',
    double: 'Hai cánh',
    sliding: 'Trượt',
    fixed: 'Cố định',
  },
  value: {
    mixed: 'Giá trị khác nhau',
    yes: 'Có',
    no: 'Không',
  },
  empty: {
    message: 'Chưa chọn đối tượng nào để xem thuộc tính.',
    tabHint: 'Nhấn Tab để duyệt vòng qua các đối tượng trên mô hình.',
  },
  partial: {
    unavailable: 'Không áp dụng cho đối tượng này.',
  },
  refusal: {
    invalidNumber: 'Chưa đọc được con số vừa nhập. Hãy nhập một giá trị bằng milimét.',
    readFailed: 'Không đọc được lớp không gian của tầng này.',
  },
  forbidden: {
    message: 'Bạn đang xem ở vai chỉ xem nên không sửa được thuộc tính này.',
  },
  collapsed: {
    expandChip: 'Mở lại thanh tra đối tượng',
  },
  inspection: {
    openRuleScreen: 'Xem quy tắc',
    clean: 'Không có vi phạm nào',
    noticeLabel: 'Ghi chú của phần mềm',
  },
  status: {
    verified: 'Đã duyệt',
    attention: 'Cần chú ý',
    violation: 'Vi phạm',
    neutral: 'Chưa duyệt',
  },
  units: {
    millimetre: 'mm',
    degree: 'độ',
  },
} as const;

/** Bí danh ngắn, dùng khắp phần còn lại của file. */
const TEXT = PROPERTY_INSPECTOR_TEXT;

/** Câu tóm tắt khi chọn nhiều đối tượng — mẫu `partial.selectionSummary` của T4. */
const selectionSummaryLabel = (count: number): string => `Đang chọn ${formatNumber(count)} đối tượng`;

/** Mẫu `relations.onWall` của T4. */
const onWallLabel = (wallId: string): string => `Nằm trên #${wallId}`;

/** Bộ đếm duyệt toàn cục, ghép vào caption chân panel để nó là con số NHÌN THẤY được. */
const approvedCountLabel = (count: number): string => `Đã duyệt ${formatNumber(count)} đối tượng`;

/** Mẫu `relations.inRoom` của T4. */
const inRoomLabel = (roomId: string): string => `Thuộc phòng #${roomId}`;

/** Nhãn tóm tắt của thẻ phụ khi panel thu gọn, ví dụ "Tường W-014". */
const collapsedSummaryLabel = (kind: ObjectKind, entityId: string): string =>
  `${capitalise(TEXT.objectKind[kind])} ${entityId}`;

/** Viết hoa chữ cái đầu — nhãn loại đối tượng là kiểu câu (A6), tiêu đề thì hoa đầu. */
function capitalise(label: string): string {
  const first = label.slice(0, 1);

  return `${first.toUpperCase()}${label.slice(1)}`;
}

/* -------------------------------------------------------------------------- */
/* Định dạng — mọi con số đi qua `src/lib/format`.                             */
/* -------------------------------------------------------------------------- */

/** Milimét viết tròn, đúng cách `toViewModel.ts` viết một số đo dưới một mét. */
const MILLIMETRE_FRACTION_DIGITS = 0;

/** Góc một chữ số thập phân, cùng độ chính xác `formatAngle` của `lib/format/measure`. */
const ANGLE_FRACTION_DIGITS = 1;

/** Một số đo milimét, viết theo lối Việt (dấu phẩy thập phân, A15). */
const millimetreText = (valueMm: number | null | undefined): string =>
  formatNumber(valueMm, { fractionDigits: MILLIMETRE_FRACTION_DIGITS });

/** Toạ độ một điểm, hai số đo milimét cạnh nhau. */
const pointText = (point: Point | undefined): string =>
  point === undefined
    ? MISSING_VALUE
    : `${millimetreText(point.x)} · ${millimetreText(point.y)}`;

/* -------------------------------------------------------------------------- */
/* Dựng một dòng.                                                              */
/* -------------------------------------------------------------------------- */

/** Cách một dòng phát lệnh: ngay lập tức, hay đợi người dùng ngừng đổi giá trị. */
type CommitMode = 'immediate' | 'settled';

/**
 * Một dòng cùng với nhóm chứa nó và cách nó phát lệnh.
 *
 * `PropertyRow` (hợp đồng T4) không mang hai thông tin đó vì view không cần biết;
 * hook thì cần, nên chúng đi kèm bên ngoài dòng chứ không nhét vào kiểu chung.
 */
interface RowDraft {
  readonly groupId: PropertyGroupId;
  readonly commitMode: CommitMode;
  readonly row: PropertyRow;
}

/** Giá trị đã định dạng của một dòng đọc-mà-không-sửa. */
const singleValue = (formatted: string): PropertyValue => ({ kind: 'single', formatted });

/** Dòng không áp dụng cho đối tượng này — caption thay cho một ô trống khó hiểu. */
const unavailableValue = (): PropertyValue => ({
  kind: 'unavailable',
  caption: TEXT.partial.unavailable,
});

/** Một thuộc tính của viewmodel, đọc theo nhãn của nó — thứ tự mảng phẳng không bị gõ lại. */
function attributeOf(attributes: readonly ViewAttribute[], label: string): ViewAttribute | null {
  return attributes.find((attribute) => attribute.label === label) ?? null;
}

/** Dòng chỉ đọc dựng thẳng từ một thuộc tính của viewmodel. */
function viewModelRow(
  id: string,
  label: string,
  groupId: PropertyGroupId,
  attribute: ViewAttribute | null,
): RowDraft {
  return {
    groupId,
    commitMode: 'immediate',
    row: {
      id,
      label,
      controlType: 'readonly',
      value: attribute === null ? unavailableValue() : singleValue(attribute.value),
      unit: attribute?.unit,
      isLocked: true,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Bốn bộ dòng, một bộ cho mỗi loại đối tượng (P-03 / P5).                     */
/* -------------------------------------------------------------------------- */

/** Ba độ dày chuẩn của SegmentedControl, kèm ô màu theo token (A1: không mã màu thô). */
const WALL_THICKNESS_OPTIONS: readonly PropertyRowOption[] = [
  { value: '110', label: `110 ${TEXT.units.millimetre}`, colorToken: '--wall-thickness-110' },
  { value: '220', label: `220 ${TEXT.units.millimetre}`, colorToken: '--wall-thickness-220' },
  { value: '330', label: `330 ${TEXT.units.millimetre}`, colorToken: '--wall-thickness-330' },
];

/** Ba loại tường của domain, nhãn theo hợp đồng T4. */
const WALL_KIND_OPTIONS: readonly PropertyRowOption[] = [
  { value: 'loadBearing', label: TEXT.wallType.loadBearing },
  { value: 'partition', label: TEXT.wallType.partition },
  { value: 'envelope', label: TEXT.wallType.envelope },
];

/** Năm chiều mở của domain (`SwingDirection`), nhãn theo hợp đồng T4. */
const SWING_OPTIONS: readonly PropertyRowOption[] = [
  { value: 'left', label: TEXT.swing.left },
  { value: 'right', label: TEXT.swing.right },
  { value: 'double', label: TEXT.swing.double },
  { value: 'sliding', label: TEXT.swing.sliding },
  { value: 'fixed', label: TEXT.swing.fixed },
];

/** Tám công năng phòng của domain — nhãn lấy từ `ROOM_USAGE_LABELS`, không gõ lại. */
const ROOM_USAGE_OPTIONS: readonly PropertyRowOption[] = (
  Object.keys(ROOM_USAGE_LABELS) as RoomUsage[]
).map((usage) => ({ value: usage, label: capitalise(ROOM_USAGE_LABELS[usage]) }));

/**
 * Tường — năm trường mặc định cộng một dòng quan hệ.
 *
 * `length` và `height` chỉ đọc: chiều dài chỉ đổi được bằng cách kéo đầu tường
 * (`wall.dragEnd`, một thao tác trong khung nhìn chứ không phải một ô nhập), và
 * `WALL_COMMAND_TYPES` không có lệnh nào ghi `heightMm`.
 */
function wallRows(wall: Wall): readonly RowDraft[] {
  const attributes = toWallViewModel(wall).attributes;

  return [
    {
      groupId: 'geometry',
      commitMode: 'immediate',
      row: {
        id: 'thickness',
        label: TEXT.fields.wall.thickness,
        controlType: 'segmented',
        value: singleValue(millimetreText(wall.thicknessMm)),
        unit: TEXT.units.millimetre,
        isLocked: false,
        options: WALL_THICKNESS_OPTIONS,
      },
    },
    viewModelRow('length', TEXT.fields.wall.length, 'geometry', attributeOf(attributes, 'Chiều dài')),
    viewModelRow('height', TEXT.fields.wall.height, 'geometry', attributeOf(attributes, 'Chiều cao')),
    {
      groupId: 'material',
      commitMode: 'immediate',
      row: {
        id: 'wallType',
        label: TEXT.fields.wall.wallType,
        controlType: 'select',
        value: singleValue(TEXT.wallType[wall.kind]),
        isLocked: false,
        options: WALL_KIND_OPTIONS,
      },
    },
    {
      groupId: 'material',
      commitMode: 'immediate',
      row: {
        id: 'isInterior',
        label: TEXT.fields.wall.isInterior,
        controlType: 'toggle',
        value: singleValue(wall.kind === 'envelope' ? TEXT.value.no : TEXT.value.yes),
        isLocked: true,
        isChecked: wall.kind !== 'envelope',
      },
    },
    viewModelRow(
      'openingCount',
      TEXT.fields.wall.openingCount,
      'relations',
      attributeOf(attributes, 'Ô mở'),
    ),
  ];
}

/** Ô mở — năm trường mặc định, dòng cuối là liên kết tới tường chủ (P7). */
function openingRows(opening: Opening): readonly RowDraft[] {
  return [
    numericRow('width', TEXT.fields.opening.width, 'geometry', opening.widthMm),
    numericRow('height', TEXT.fields.opening.height, 'geometry', opening.heightMm),
    numericRow('sillHeight', TEXT.fields.opening.sillHeight, 'geometry', opening.sillHeightMm),
    {
      groupId: 'material',
      commitMode: 'immediate',
      row: {
        id: 'swingDirection',
        label: TEXT.fields.opening.swingDirection,
        controlType: 'select',
        value: singleValue(TEXT.swing[opening.swing]),
        isLocked: false,
        options: SWING_OPTIONS,
      },
    },
    {
      groupId: 'relations',
      commitMode: 'immediate',
      row: {
        id: 'hostWallId',
        label: TEXT.fields.opening.hostWallId,
        controlType: 'link',
        value: singleValue(onWallLabel(opening.wallId)),
        isLocked: true,
        linkedEntityId: opening.wallId,
      },
    },
  ];
}

/** Phòng — năm trường mặc định; số cửa và số cửa sổ là quan hệ, ghép từ đồ thị. */
function roomRows(room: Room, graph: NormalizedSpatial): readonly RowDraft[] {
  const attributes = toRoomViewModel(room).attributes;
  const counts = roomOpeningCountsOf(graph, room);

  return [
    viewModelRow('area', TEXT.fields.room.area, 'geometry', attributeOf(attributes, 'Diện tích')),
    {
      groupId: 'material',
      commitMode: 'settled',
      row: {
        id: 'name',
        label: TEXT.fields.room.name,
        controlType: 'text',
        value: singleValue(room.name.trim() === '' ? MISSING_VALUE : room.name),
        isLocked: false,
      },
    },
    {
      groupId: 'material',
      commitMode: 'immediate',
      row: {
        id: 'function',
        label: TEXT.fields.room.function,
        controlType: 'select',
        value: singleValue(capitalise(ROOM_USAGE_LABELS[room.usage])),
        isLocked: false,
        options: ROOM_USAGE_OPTIONS,
      },
    },
    readonlyCountRow('doorCount', TEXT.fields.room.doorCount, counts.doorCount),
    readonlyCountRow('windowCount', TEXT.fields.room.windowCount, counts.windowCount),
  ];
}

/**
 * Nội thất — hai trường cố định cộng hai trường tuỳ hạng mục.
 *
 * `boundingSize` chỉ đọc: không lệnh nào ghi lại `boundingBox`; `movedFurniture`
 * chỉ DỊCH hộp bao theo `centre`, giữ nguyên kích thước. Bề rộng và bề sâu đọc
 * thẳng hai đầu hộp bao đã lưu — đọc kích thước của một hộp có sẵn, không dựng
 * lại hình học nào.
 */
function furnitureRows(furniture: Furniture): readonly RowDraft[] {
  const { max, min } = furniture.boundingBox;
  const roomId = furniture.roomId;

  return [
    {
      groupId: 'geometry',
      commitMode: 'immediate',
      row: {
        id: 'boundingSize',
        label: TEXT.fields.furniture.boundingSize,
        controlType: 'text',
        value: singleValue(`${millimetreText(max.x - min.x)} × ${millimetreText(max.y - min.y)}`),
        unit: TEXT.units.millimetre,
        isLocked: true,
      },
    },
    {
      groupId: 'geometry',
      commitMode: 'settled',
      row: {
        id: 'rotation',
        label: TEXT.fields.furniture.rotation,
        controlType: 'numeric',
        value: singleValue(
          formatNumber(furniture.rotationDeg, { fractionDigits: ANGLE_FRACTION_DIGITS }),
        ),
        unit: TEXT.units.degree,
        isLocked: false,
      },
    },
    {
      groupId: 'material',
      commitMode: 'immediate',
      row: {
        id: 'furnitureKind',
        label: TEXT.fields.furniture.furnitureKind,
        controlType: 'readonly',
        value: singleValue(capitalise(FURNITURE_KIND_LABELS[furniture.kind])),
        isLocked: true,
      },
    },
    {
      groupId: 'relations',
      commitMode: 'immediate',
      row: {
        id: 'roomId',
        label: TEXT.fields.furniture.roomId,
        controlType: roomId === undefined ? 'readonly' : 'link',
        value: roomId === undefined ? unavailableValue() : singleValue(inRoomLabel(roomId)),
        isLocked: true,
        linkedEntityId: roomId,
      },
    },
  ];
}

/** Một dòng số sửa được, luôn theo milimét ở cả hai chiều đọc và ghi. */
function numericRow(
  id: string,
  label: string,
  groupId: PropertyGroupId,
  valueMm: number,
): RowDraft {
  return {
    groupId,
    commitMode: 'settled',
    row: {
      id,
      label,
      controlType: 'numeric',
      value: singleValue(millimetreText(valueMm)),
      unit: TEXT.units.millimetre,
      isLocked: false,
    },
  };
}

/** Một dòng đếm chỉ đọc — không đơn vị, đúng cách `countAttribute` của viewmodel viết. */
function readonlyCountRow(id: string, label: string, count: number): RowDraft {
  return {
    groupId: 'relations',
    commitMode: 'immediate',
    row: {
      id,
      label,
      controlType: 'readonly',
      value: singleValue(formatNumber(count)),
      isLocked: true,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Khối gập "Thông số nâng cao" — bốn trường giống nhau ở cả bốn loại (P6).     */
/* -------------------------------------------------------------------------- */

/** Cao độ của tầng chứa đối tượng; ô mở mượn tầng của tường chủ. */
function levelElevationMm(graph: NormalizedSpatial, entity: InspectableEntity): number | null {
  const levelId = isEntityOfKind('opening', entity)
    ? (readEntity(graph, 'wall', entity.wallId)?.levelId ?? null)
    : entity.levelId;

  if (levelId === null) {
    return null;
  }

  return readEntity(graph, 'level', levelId)?.elevationMm ?? null;
}

/** Hai đầu của một đối tượng: hai đầu tim tường, hai đỉnh biên phòng, hai góc hộp bao. */
function endpointsOf(entity: InspectableEntity): readonly [Point | undefined, Point | undefined] {
  if (isEntityOfKind('wall', entity)) {
    return [entity.centreline.start, entity.centreline.end];
  }

  if (isEntityOfKind('room', entity)) {
    return [entity.outline[0], entity.outline[entity.outline.length - 1]];
  }

  if (isEntityOfKind('furniture', entity)) {
    return [entity.boundingBox.min, entity.boundingBox.max];
  }

  return [undefined, undefined];
}

/** Năm dòng của khối gập, giống nhau ở cả bốn loại đối tượng. */
function advancedRows(entity: InspectableEntity, graph: NormalizedSpatial): readonly RowDraft[] {
  const elevationMm = levelElevationMm(graph, entity);
  const [start, end] = endpointsOf(entity);

  const advanced = (id: string, label: string, formatted: string, unit?: string): RowDraft => ({
    groupId: COLLAPSIBLE_GROUP_ID,
    commitMode: 'immediate',
    row: {
      id,
      label,
      controlType: 'readonly',
      value: formatted === MISSING_VALUE ? unavailableValue() : singleValue(formatted),
      unit,
      isLocked: true,
    },
  });

  return [
    advanced(
      'zOffset',
      TEXT.fields.advanced.zOffset,
      millimetreText(elevationMm),
      TEXT.units.millimetre,
    ),
    advanced(
      'startPoint',
      TEXT.fields.advanced.startPoint,
      pointText(start),
      TEXT.units.millimetre,
    ),
    advanced('endPoint', TEXT.fields.advanced.endPoint, pointText(end), TEXT.units.millimetre),
    advanced('sourceEntityId', TEXT.fields.advanced.sourceEntityId, entity.id),
    advanced(
      'confidence',
      TEXT.fields.advanced.confidence,
      isFormattable(entity.confidence) ? formatPercent(entity.confidence) : MISSING_VALUE,
    ),
  ];
}

/** Bộ dòng đầy đủ của một đối tượng, chưa gắn callback và chưa gắn cảnh báo. */
function draftsOf(entity: InspectableEntity, graph: NormalizedSpatial): readonly RowDraft[] {
  const own = isEntityOfKind('wall', entity)
    ? wallRows(entity)
    : isEntityOfKind('opening', entity)
      ? openingRows(entity)
      : isEntityOfKind('room', entity)
        ? roomRows(entity, graph)
        : furnitureRows(entity);

  return [...own, ...advancedRows(entity, graph)];
}

/* -------------------------------------------------------------------------- */
/* Giao thuộc tính khi chọn nhiều (CẤM TUYỆT ĐỐI số 4).                        */
/* -------------------------------------------------------------------------- */

/** Hai giá trị có đọc ra cùng một câu không. */
function sameValue(first: PropertyValue, second: PropertyValue): boolean {
  if (first.kind !== second.kind) {
    return false;
  }

  return first.kind === 'single' && second.kind === 'single'
    ? first.formatted === second.formatted
    : true;
}

/**
 * Giao các bộ dòng của nhiều đối tượng thành MỘT bộ.
 *
 * Dòng nào không có ở đủ mọi đối tượng thành `unavailable`; dòng nào có đủ nhưng
 * giá trị lệch nhau thành `mixed`. Không dòng nào rơi về một giá trị đơn của
 * riêng đối tượng đầu tiên — đó chính là điều CẤM TUYỆT ĐỐI số 4 cấm.
 */
function intersectDrafts(drafts: readonly (readonly RowDraft[])[]): readonly RowDraft[] {
  const first = drafts[0];

  if (first === undefined) {
    return [];
  }

  if (drafts.length === 1) {
    return first;
  }

  return first.map((draft) => {
    let value = draft.row.value;

    for (const other of drafts.slice(1)) {
      const match = other.find((candidate) => candidate.row.id === draft.row.id);

      if (match === undefined) {
        value = unavailableValue();
        break;
      }

      if (!sameValue(value, match.row.value)) {
        value = { kind: 'mixed' };
      }
    }

    return { ...draft, row: { ...draft.row, value, isLocked: true } };
  });
}

/* -------------------------------------------------------------------------- */
/* M-12 — vi phạm gắn vào đúng dòng gây ra nó.                                 */
/* -------------------------------------------------------------------------- */

/**
 * Dòng nào chịu trách nhiệm cho mã luật nào.
 *
 * `WALL-THICKNESS` và `WALL-LENGTH` là hai luật của M-04, `OPENING-IN-WALL` là
 * luật của M-08 — cả ba đều nằm trong tám luật gốc luôn bật. Mã nào không có dòng
 * tương ứng thì rơi xuống nhóm "Kiểm tra" thành một dòng riêng, không bị nuốt mất.
 */
const ROW_ID_BY_RULE_CODE: Readonly<Record<string, string>> = {
  'WALL-THICKNESS': 'thickness',
  'WALL-LENGTH': 'length',
  'OPENING-IN-WALL': 'width',
  'DOOR-WIDTH': 'width',
  'ROOM-MIN-AREA': 'area',
  'ROOM-UNNAMED': 'name',
  'ROOM-HAS-DOOR': 'doorCount',
};

/** Vi phạm nặng nhất chặn lối, còn lại chỉ nhắc. */
const isBlocking = (violation: Violation): boolean => violation.severity === 'critical';

/* -------------------------------------------------------------------------- */
/* Bảy trạng thái (A11 / R-63).                                                */
/* -------------------------------------------------------------------------- */

/** Mọi thứ quyết định trạng thái, gom vào một chỗ để hàm dưới đây thuần. */
export interface PropertyInspectorStateInput {
  readonly isPanelCollapsed: boolean;
  readonly hasSelection: boolean;
  readonly isPending: boolean;
  readonly hasEntity: boolean;
  readonly canEdit: boolean;
  readonly hasBlockingRow: boolean;
  readonly isMultiple: boolean;
  readonly hasIncompleteValue: boolean;
}

/** Tên của trạng thái panel đang ở, tính từ tám điều kiện trên. */
export type PropertyInspectorStateName = PropertyInspectorState['kind'];

/**
 * Trạng thái của panel — một hàm thuần, kiểm được không cần dựng hook.
 *
 * Thứ tự các nhánh là thứ tự ưu tiên: panel thu gọn thì không có gì để đọc; chưa
 * chọn gì thì không có gì để tải; đang tải thì chưa biết có quyền hay không.
 */
export function derivePropertyInspectorState(
  input: PropertyInspectorStateInput,
): PropertyInspectorStateName {
  if (input.isPanelCollapsed) {
    return 'collapsed';
  }

  if (!input.hasSelection) {
    return 'empty';
  }

  if (input.isPending) {
    return 'loading';
  }

  if (!input.hasEntity) {
    return 'empty';
  }

  if (!input.canEdit) {
    return 'forbidden';
  }

  if (input.hasBlockingRow) {
    return 'error';
  }

  return input.isMultiple || input.hasIncompleteValue ? 'partial' : 'success';
}

/* -------------------------------------------------------------------------- */
/* Lệnh của từng dòng (S-07).                                                  */
/* -------------------------------------------------------------------------- */

/** Một lượt ghi bị từ chối, gắn với đúng dòng đã gây ra nó. */
interface RowRefusal {
  readonly rowId: string;
  readonly message: string;
  readonly retry: () => void;
}

/** `true` khi chuỗi là một trong ba loại tường của domain. */
const isWallKind = (value: string): value is WallKind =>
  value === 'loadBearing' || value === 'partition' || value === 'envelope';

/** `true` khi chuỗi là một trong năm chiều mở của domain. */
const isSwingDirection = (value: string): value is SwingDirection =>
  value === 'left' || value === 'right' || value === 'double' || value === 'sliding' || value === 'fixed';

/** `true` khi chuỗi là một trong tám công năng phòng của domain. */
const isRoomUsage = (value: string): value is RoomUsage => value in ROOM_USAGE_LABELS;

/**
 * Lệnh ứng với một dòng và giá trị mới, hoặc `null` khi dòng đó không ghi được.
 *
 * Mọi nhánh gọi một hàm `create…Command` có sẵn của `src/lib/commands/business`;
 * riêng chiều mở đi qua {@link buildChangeSwingCommand} của cổng vì tầng lệnh
 * không có lệnh nào ghi `swing` trên một ô mở đã tồn tại. Validate đã chạy BÊN
 * TRONG các hàm đó, nên hook không kiểm lại một luật nào.
 */
function commandForRow(
  entity: InspectableEntity,
  rowId: string,
  nextValue: string,
  context: CommandContext,
): CommandResult | null {
  if (isEntityOfKind('wall', entity)) {
    if (rowId === 'thickness') {
      const thicknessMm = parseNumber(nextValue);

      return thicknessMm === undefined
        ? null
        : createChangeWallThicknessCommand({ thicknessMm, wallId: entity.id }, context);
    }

    if (rowId === 'wallType' && isWallKind(nextValue)) {
      return createChangeWallKindCommand({ kind: nextValue, wallId: entity.id }, context);
    }

    return null;
  }

  if (isEntityOfKind('opening', entity)) {
    if (rowId === 'swingDirection' && isSwingDirection(nextValue)) {
      return { ok: true, data: buildChangeSwingCommand(entity, nextValue, context.actorId) };
    }

    const measureMm = parseNumber(nextValue);

    if (measureMm === undefined) {
      return null;
    }

    if (rowId === 'width') {
      return createResizeOpeningCommand({ openingId: entity.id, widthMm: measureMm }, context);
    }

    if (rowId === 'height') {
      return createResizeOpeningCommand({ heightMm: measureMm, openingId: entity.id }, context);
    }

    if (rowId === 'sillHeight') {
      return createResizeOpeningCommand({ openingId: entity.id, sillHeightMm: measureMm }, context);
    }

    return null;
  }

  if (isEntityOfKind('room', entity)) {
    if (rowId === 'name') {
      return createRenameRoomCommand({ name: nextValue, roomId: entity.id }, context);
    }

    if (rowId === 'function' && isRoomUsage(nextValue)) {
      return createChangeRoomUsageCommand({ roomId: entity.id, usage: nextValue }, context);
    }

    return null;
  }

  if (rowId === 'rotation') {
    const rotationDeg = parseNumber(nextValue);

    return rotationDeg === undefined
      ? null
      : createRotateFurnitureCommand({ furnitureId: entity.id, rotationDeg }, context);
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Kết quả của hook.                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Những gì hook trả về: ĐÚNG props của view, không hơn một trường nào.
 *
 * Tín hiệu "dòng vừa được ghi nhận" đã được nâng lên `propertyInspectorTypes.ts`
 * ở bước ráp, nên `UsePropertyInspectorResult` mang đủ cả hai trường và không
 * còn kiểu mở rộng riêng của hook nữa: container chỉ việc trải kết quả này vào
 * view. Thời lượng nháy không đi kèm — `FieldRow` đã nháy đúng nhịp `slow`.
 */

/* -------------------------------------------------------------------------- */
/* Hook.                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Nối `PropertyInspector` với đồ thị không gian, tầng lệnh và bộ luật.
 *
 * @param options Vai, vùng chọn và ba callback ra ngoài (P8).
 * @param injectedGateway Chỉ dành cho test và story — mặc định là cổng thật đọc store.
 */
export function usePropertyInspector(
  options: UsePropertyInspectorOptions,
  injectedGateway?: PropertyInspectorGateway,
): UsePropertyInspectorResult {
  const graph = useStore((state) => state.spatial);
  const activeFloorId = useStore((state) => state.activeFloorId);
  const isPanelOpen = useStore((state) => state.rightPanelOpen);
  const setPanelOpen = useStore((state) => state.setPanelOpen);
  const violations = useStore(selectViolations);

  const gateway = useMemo(
    () =>
      injectedGateway ??
      createPropertyInspectorGateway({ graph: { read: () => useStore.getState().spatial } }),
    [injectedGateway],
  );

  /* ---------------------------------------------------------------------- */
  /* Lượt đọc máy chủ — nguồn DUY NHẤT của "đang tải" và "hỏng" (R-64).      */
  /* ---------------------------------------------------------------------- */

  const spatialQuery = useQuery({
    queryKey: queryKeys.space.byFloor(activeFloorId ?? ''),
    queryFn: () => gateway.readSpatialLayer(),
  });

  /* ---------------------------------------------------------------------- */
  /* Trạng thái cục bộ — KHÔNG có cờ tải hay cờ hỏng nào ở đây.              */
  /* ---------------------------------------------------------------------- */

  /** Giá trị đang gõ/đang kéo, chỉ để HIỆN trong panel; store chưa hề biết tới nó. */
  const [pendingText, setPendingText] = useState<Readonly<Record<string, string>>>({});
  const [refusal, setRefusal] = useState<RowRefusal | null>(null);
  const [writtenRowId, setWrittenRowId] = useState<string | null>(null);
  const [isAdvancedOpen, setAdvancedOpen] = useState(false);

  const isFlashing = useCommitFlash();

  /* ---------------------------------------------------------------------- */
  /* Đường ghi — dựng MỘT lần, giữ nguyên ngăn xếp hoàn tác qua các lượt vẽ. */
  /* ---------------------------------------------------------------------- */

  /* Ba callback ra ngoài đi qua một ref: container dựng lại `options` mỗi lượt
   * vẽ, và nếu chúng nằm thẳng trong danh sách phụ thuộc thì mọi `useMemo` dưới
   * đây mất tác dụng. Ref giữ bản mới nhất mà không làm mới danh sách nào. */
  const callbacksRef = useRef({
    onDismiss: options.onDismiss,
    onNavigateToObject: options.onNavigateToObject,
    onOpenRuleScreen: options.onOpenRuleScreen,
  });
  callbacksRef.current = {
    onDismiss: options.onDismiss,
    onNavigateToObject: options.onNavigateToObject,
    onOpenRuleScreen: options.onOpenRuleScreen,
  };

  const bundleRef = useRef<PropertyInspectorDispatchBundle | null>(null);

  if (bundleRef.current === null) {
    bundleRef.current = createPropertyInspectorDispatchDeps({
      graph: gateway.graph,
      /* Ảnh chụp vùng chọn lấy từ CHÍNH `selectionSlice`, không từ `options`:
       * `HistoryStep` khôi phục đúng vùng chọn của phiên làm việc khi hoàn tác,
       * và chỉ store mới giữ các id đã hẹp kiểu (`EntityId`). */
      selectionBefore: () => ({ selectedIds: useStore.getState().selectedIds }),
      selectionAfter: () => ({ selectedIds: useStore.getState().selectedIds }),
      onSynced: () => {
        /* Bước `sync` của `dispatch`: `useAutosave` đã theo dõi `state.spatial`
         * nên không có hàng đợi thứ hai nào ở đây — bản vẽ bẩn được chính lượt
         * ghi vào store thông báo. */
      },
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Tự lưu (D-07) và chỉ báo (D-08).                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * Lượt lưu THẬT — và nó ném, vì chưa có đích để gửi tới.
   *
   * Không endpoint nào nhận lớp không gian vừa sửa (xem
   * `PERSIST_PROPERTIES_UNSUPPORTED_REASON` ở cổng). Lượt lưu ném để chỉ báo nói
   * ra sự thật, thay vì hiện "Đã lưu lúc…" cho một thay đổi chưa rời khỏi máy.
   * Bộ đếm 800 ms của A7 nằm trong chính `useAutosave`, không viết lại ở đây.
   */
  const persist = useCallback(async (): Promise<void> => {
    const result = gateway.persistProperties();

    if (!result.ok) {
      throw new Error(result.reason);
    }
  }, [gateway]);

  const saveLabel = useAutosave(persist);

  /* ---------------------------------------------------------------------- */
  /* Ghi — build lệnh, dispatch, rồi nhớ dòng vừa ghi.                       */
  /* ---------------------------------------------------------------------- */

  const settleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = settleTimersRef.current;

    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      timers.clear();
    };
  }, []);

  const writeRef = useRef<((rowId: string, nextValue: string, entityId: string) => void) | null>(
    null,
  );

  /**
   * Bỏ giá trị đang gõ của một dòng.
   *
   * Gọi cả khi ghi xong lẫn khi bị từ chối: hợp đồng T4 nói rõ ở trạng thái
   * `error` thì "giá trị của dòng đã quay về giá trị cũ trước khi tới view" —
   * dòng hiện lại con số đang có thật trong mô hình, còn lý do từ chối nằm ở
   * cảnh báo của chính dòng đó.
   */
  const dropPending = useCallback((rowId: string): void => {
    setPendingText((previous) => {
      const remaining: Record<string, string> = {};

      for (const [key, text] of Object.entries(previous)) {
        if (key !== rowId) {
          remaining[key] = text;
        }
      }

      return remaining;
    });
  }, []);

  const write = useCallback(
    async (rowId: string, nextValue: string, entityId: string): Promise<void> => {
      const bundle = bundleRef.current;
      const current = useStore.getState().spatial;
      const entity = readInspectableEntity(current, entityId);

      if (bundle === null || current === null || entity === null) {
        return;
      }

      const built = commandForRow(entity, rowId, nextValue, {
        actorId: gateway.actorId,
        graph: current,
      });

      if (built === null) {
        dropPending(rowId);
        setRefusal({
          message: TEXT.refusal.invalidNumber,
          retry: () => {
            setRefusal(null);
          },
          rowId,
        });

        return;
      }

      if (!built.ok) {
        dropPending(rowId);
        setRefusal({
          message: built.error.reasons.join(' '),
          retry: () => {
            writeRef.current?.(rowId, nextValue, entityId);
          },
          rowId,
        });

        return;
      }

      const result = await runInspectorCommand(built.data, bundle);

      if (!result.ok) {
        dropPending(rowId);
        setRefusal({
          message: result.error.reasons.join(' '),
          retry: () => {
            writeRef.current?.(rowId, nextValue, entityId);
          },
          rowId,
        });

        return;
      }

      setRefusal(null);
      setWrittenRowId(rowId);
      dropPending(rowId);
    },
    [dropPending, gateway],
  );

  writeRef.current = (rowId, nextValue, entityId) => {
    void write(rowId, nextValue, entityId);
  };

  /**
   * Người dùng đổi giá trị một dòng.
   *
   * Dòng `settled` (ô số, ô chữ, thanh trượt) chỉ đổi CON SỐ HIỆN TRONG PANEL
   * trong lúc còn đang đổi, và phát lệnh khi giá trị đứng yên hết một cửa sổ
   * {@link MERGE_WINDOW_MS}. Đó là hệ quả trực tiếp của mục C5: không có kênh xem
   * trước 3D nào gọi được từ tầng màn hình, nên phát lệnh mỗi khung hình chỉ tổ
   * ép `Viewer3D` dựng lại toàn cảnh qua worker hàng chục lần một giây. Cùng cửa
   * sổ đó là cửa sổ `HistoryStack` gộp lệnh, nên hai lượt ghi sát nhau vẫn về
   * chung MỘT bước hoàn tác (D-06).
   */
  const changeRow = useCallback(
    (rowId: string, commitMode: CommitMode, entityId: string, nextValue: string): void => {
      setPendingText((previous) => ({ ...previous, [rowId]: nextValue }));

      const timers = settleTimersRef.current;
      const running = timers.get(rowId);

      if (running !== undefined) {
        clearTimeout(running);
        timers.delete(rowId);
      }

      if (commitMode === 'immediate') {
        void write(rowId, nextValue, entityId);

        return;
      }

      timers.set(
        rowId,
        setTimeout(() => {
          timers.delete(rowId);
          void write(rowId, nextValue, entityId);
        }, MERGE_WINDOW_MS),
      );
    },
    [write],
  );

  /* ---------------------------------------------------------------------- */
  /* Đọc — đối tượng đang chọn và vi phạm của nó.                            */
  /* ---------------------------------------------------------------------- */

  const primaryId = options.selectedEntityId;

  const entities = useMemo(() => {
    const resolved: InspectableEntity[] = [];

    for (const id of options.selectedEntityIds) {
      const entity = readInspectableEntity(graph, id);

      if (entity !== null) {
        resolved.push(entity);
      }
    }

    if (resolved.length === 0 && primaryId !== null) {
      const single = readInspectableEntity(graph, primaryId);

      if (single !== null) {
        resolved.push(single);
      }
    }

    return resolved;
  }, [graph, options.selectedEntityIds, primaryId]);

  const primaryEntity = entities.find((entity) => entity.id === primaryId) ?? entities[0] ?? null;
  const entityViolations = violationsOfEntity(violations, primaryEntity?.id ?? null);

  /* ---------------------------------------------------------------------- */
  /* Khuôn mẫu — khả năng chưa có ở bất cứ tầng nào.                         */
  /* ---------------------------------------------------------------------- */

  const [templateNotice, setTemplateNotice] = useState<string | null>(null);

  const copyAsTemplate = useCallback((): void => {
    const result = gateway.copyAsTemplate();

    setTemplateNotice(result.ok ? null : result.reason);
  }, [gateway]);

  /* ---------------------------------------------------------------------- */
  /* Duyệt và bỏ qua (H8).                                                   */
  /* ---------------------------------------------------------------------- */

  const goToNextUnapproved = useCallback(
    (entity: InspectableEntity): void => {
      const kind = objectKindOf(entity);

      if (kind === null) {
        return;
      }

      const nextId = nextUnapprovedIdOf(useStore.getState().spatial, kind, entity.id);

      if (nextId !== null) {
        callbacksRef.current.onNavigateToObject(nextId);
      }
    },
    [],
  );

  const approve = useCallback((): void => {
    const bundle = bundleRef.current;

    if (bundle === null || primaryEntity === null) {
      return;
    }

    void runInspectorCommand(buildApproveCommand(primaryEntity, gateway.actorId), bundle).then(
      (result) => {
        if (result.ok) {
          goToNextUnapproved(primaryEntity);

          return;
        }

        setRefusal({
          message: result.error.reasons.join(' '),
          retry: () => {
            setRefusal(null);
          },
          rowId: 'sourceEntityId',
        });
      },
    );
  }, [gateway, goToNextUnapproved, primaryEntity]);

  const skip = useCallback((): void => {
    if (primaryEntity !== null) {
      goToNextUnapproved(primaryEntity);
    }
  }, [goToNextUnapproved, primaryEntity]);

  /* ---------------------------------------------------------------------- */
  /* Dựng các nhóm.                                                          */
  /* ---------------------------------------------------------------------- */

  const isMultiple = entities.length > 1;

  const drafts = useMemo(() => {
    if (graph === null || entities.length === 0) {
      return [];
    }

    return intersectDrafts(entities.map((entity) => draftsOf(entity, graph)));
  }, [entities, graph]);

  const groups = useMemo((): readonly PropertyGroup[] => {
    if (primaryEntity === null) {
      return [];
    }

    const canWrite = options.canEdit && !isMultiple;
    const rowsByGroup = new Map<PropertyGroupId, PropertyRow[]>(
      PROPERTY_GROUP_IDS.map((groupId) => [groupId, []]),
    );

    for (const draft of drafts) {
      const violation = entityViolations.find(
        (candidate) => ROW_ID_BY_RULE_CODE[candidate.ruleCode] === draft.row.id,
      );
      const rowRefusal = refusal !== null && refusal.rowId === draft.row.id ? refusal : null;
      const pending = pendingText[draft.row.id];
      const isLocked = draft.row.isLocked || !canWrite;
      const linkedEntityId =
        draft.row.controlType === 'link' ? draft.row.linkedEntityId : undefined;

      const row: PropertyRow = {
        ...draft.row,
        isLocked,
        value:
          pending === undefined || draft.row.value.kind !== 'single'
            ? draft.row.value
            : singleValue(pending),
        warning:
          rowRefusal !== null
            ? { level: 'blocking', message: rowRefusal.message, onRetry: rowRefusal.retry }
            : violation !== undefined
              ? {
                  level: isBlocking(violation) ? 'blocking' : 'attention',
                  message: `${violation.message} ${violation.suggestion}`,
                }
              : undefined,
        onChange: isLocked
          ? undefined
          : (nextValue: string): void => {
              changeRow(draft.row.id, draft.commitMode, primaryEntity.id, nextValue);
            },
        onNavigate: linkedEntityId === undefined
          ? undefined
          : (): void => {
              callbacksRef.current.onNavigateToObject(linkedEntityId);
            },
      };

      rowsByGroup.get(draft.groupId)?.push(row);
    }

    /* Nhóm "Kiểm tra": vi phạm nào không có dòng tương ứng thì thành dòng riêng
     * ở đây, cộng một lối sang màn luật. Không vi phạm nào bị nuốt mất. */
    const inspectionRows = rowsByGroup.get('inspection') ?? [];

    for (const violation of entityViolations) {
      if (ROW_ID_BY_RULE_CODE[violation.ruleCode] !== undefined) {
        continue;
      }

      inspectionRows.push({
        id: `violation-${violation.ruleCode}`,
        label: violation.ruleCode,
        controlType: 'readonly',
        value: singleValue(violation.message),
        isLocked: true,
        warning: {
          level: isBlocking(violation) ? 'blocking' : 'attention',
          message: violation.suggestion,
        },
      });
    }

    if (templateNotice !== null) {
      inspectionRows.push({
        id: 'templateNotice',
        label: TEXT.inspection.noticeLabel,
        controlType: 'readonly',
        value: singleValue(templateNotice),
        isLocked: true,
        warning: { level: 'attention', message: templateNotice },
      });
    }

    inspectionRows.push({
      id: 'openRuleScreen',
      label: TEXT.inspection.openRuleScreen,
      controlType: 'link',
      value: singleValue(
        entityViolations.length === 0
          ? TEXT.inspection.clean
          : `${formatNumber(entityViolations.length)} ${TEXT.status.violation.toLowerCase()}`,
      ),
      isLocked: true,
      linkedEntityId: primaryEntity.id,
      onNavigate: (): void => {
        callbacksRef.current.onOpenRuleScreen(primaryEntity.id);
      },
    });

    return PROPERTY_GROUP_IDS.map((groupId) => ({
      id: groupId,
      label: PROPERTY_GROUP_LABELS[groupId],
      rows: rowsByGroup.get(groupId) ?? [],
      isExpanded: groupId === COLLAPSIBLE_GROUP_ID ? isAdvancedOpen : undefined,
      onToggleExpanded:
        groupId === COLLAPSIBLE_GROUP_ID
          ? (): void => {
              setAdvancedOpen((previous) => !previous);
            }
          : undefined,
    }));
  }, [
    changeRow,
    drafts,
    entityViolations,
    isAdvancedOpen,
    isMultiple,
    options.canEdit,
    pendingText,
    primaryEntity,
    refusal,
    templateNotice,
  ]);

  /* ---------------------------------------------------------------------- */
  /* Header, chân panel, và bảy trạng thái.                                  */
  /* ---------------------------------------------------------------------- */

  const primaryKind = primaryEntity === null ? null : objectKindOf(primaryEntity);

  /* Bộ đếm duyệt toàn cục (H8) — suy từ chính đồ thị, nên nó tự tăng ngay khi
   * lệnh duyệt ghi xong; không có biến đếm nào được nuôi tay. */
  const approvedCount = useMemo(() => approvedCountOf(graph), [graph]);

  const statusBadge = useMemo((): PropertyStatusBadge => {
    if (primaryEntity === null) {
      return { label: TEXT.status.neutral, tone: 'neutral' };
    }

    /* A5: cờ xanh CHỈ đánh dấu việc người duyệt. Một thực thể do AI dựng không
     * bao giờ được đọc thành "đã duyệt", kể cả khi `reviewed` bằng `true`. */
    if (primaryEntity.reviewed && primaryEntity.source === 'human') {
      return { label: TEXT.status.verified, tone: 'verified' };
    }

    if (entityViolations.some(isBlocking)) {
      return { label: TEXT.status.violation, tone: 'violation' };
    }

    return entityViolations.length > 0
      ? { label: TEXT.status.attention, tone: 'attention' }
      : { label: TEXT.status.neutral, tone: 'neutral' };
  }, [entityViolations, primaryEntity]);

  /* Trạng thái `error` là "một giá trị VỪA SỬA bị từ chối", không phải "đối tượng
   * này đang vi phạm một luật". Một vi phạm có sẵn vẫn hiện cảnh báo tại dòng của
   * nó, nhưng nó không biến cả panel thành trạng thái lỗi — nếu không thì mọi
   * tường mỏng quá đều mở panel ở trạng thái 4 và người dùng không sửa được gì. */
  const hasBlockingRow = refusal !== null;

  const hasIncompleteValue = drafts.some((draft) => draft.row.value.kind !== 'single');

  const stateName = derivePropertyInspectorState({
    canEdit: options.canEdit,
    hasBlockingRow,
    hasEntity: primaryEntity !== null,
    hasIncompleteValue,
    hasSelection: primaryId !== null || options.selectedEntityIds.length > 0,
    isMultiple,
    isPanelCollapsed: !isPanelOpen,
    isPending: spatialQuery.isPending || graph === null,
  });

  /* Lượt đọc lớp không gian hỏng: nói ra ngay tại dòng đầu tiên, và nút "Thử
   * lại" là chính `refetch` của react-query — không có lượt thử lại tự viết. */
  const readFailedRowId = groups[0]?.rows[0]?.id ?? null;

  const hasReadFailed = spatialQuery.isError;
  const refetchSpatial = spatialQuery.refetch;

  useEffect(() => {
    if (hasReadFailed && readFailedRowId !== null) {
      setRefusal({
        message: TEXT.refusal.readFailed,
        retry: () => {
          void refetchSpatial();
        },
        rowId: readFailedRowId,
      });
    }
  }, [hasReadFailed, readFailedRowId, refetchSpatial]);

  const state = useMemo((): PropertyInspectorState => {
    if (stateName === 'collapsed') {
      return {
        kind: 'collapsed',
        /* Chỉ có biến thể `chip`: repo không có hook truy vấn media nào và không
         * có hằng số điểm ngắt di động, nên chọn `sheet` ở đây sẽ là viết một
         * ngưỡng bằng tay (R-71). Tấm trượt là quyết định của tầng view. */
        variant: 'chip',
        summaryLabel:
          primaryEntity === null || primaryKind === null
            ? TEXT.collapsed.expandChip
            : collapsedSummaryLabel(primaryKind, primaryEntity.id),
        onExpand: (): void => {
          setPanelOpen('right', true);
        },
      };
    }

    if (stateName === 'empty') {
      return { kind: 'empty', message: TEXT.empty.message, tabHint: TEXT.empty.tabHint };
    }

    if (stateName === 'loading') {
      return { kind: 'loading' };
    }

    if (primaryEntity === null || primaryKind === null) {
      return { kind: 'empty', message: TEXT.empty.message, tabHint: TEXT.empty.tabHint };
    }

    const content = {
      header: {
        objectKind: primaryKind,
        objectKindLabel: isMultiple
          ? selectionSummaryLabel(entities.length)
          : capitalise(TEXT.objectKind[primaryKind]),
        objectCode: primaryEntity.id,
        statusBadge,
        selectionCount: entities.length,
        onCopyAsTemplate: copyAsTemplate,
        onClose: options.onDismiss,
      },
      /* Dải ảnh rỗng: không tầng nào trong repo dựng ảnh thu nhỏ cho một thực thể
       * không gian. Hợp đồng T4 nói rõ rỗng thì dải ảnh không vẽ gì, nên đây là
       * sự thật chứ không phải một ô trống. */
      thumbnails: [],
      groups,
      footer: {
        onApprove: approve,
        onSkip: skip,
        lastEditedCaption: [saveLabel, approvedCountLabel(approvedCount)]
          .filter((part): part is string => part !== null && part !== '')
          .join(' · '),
      },
    };

    if (stateName === 'forbidden') {
      return {
        kind: 'forbidden',
        ...content,
        groups: content.groups.map((group) => ({
          ...group,
          rows: group.rows.map((row) => ({ ...row, isLocked: true, onChange: undefined })),
        })),
      };
    }

    if (stateName === 'error') {
      return {
        kind: 'error',
        ...content,
        erroredRowId: refusal?.rowId ?? readFailedRowId ?? primaryEntity.id,
      };
    }

    return stateName === 'partial' ? { kind: 'partial', ...content } : { kind: 'success', ...content };
  }, [
    approve,
    approvedCount,
    copyAsTemplate,
    entities.length,
    groups,
    isMultiple,
    options.onDismiss,
    primaryEntity,
    primaryKind,
    readFailedRowId,
    refusal,
    saveLabel,
    setPanelOpen,
    skip,
    stateName,
    statusBadge,
  ]);

  return { state, recentlyCommittedRowId: isFlashing ? writtenRowId : null };
}
