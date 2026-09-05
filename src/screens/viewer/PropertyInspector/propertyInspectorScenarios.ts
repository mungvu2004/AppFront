/**
 * Bảy kịch bản của `PropertyInspector`, dựng sẵn để story và bài kiểm dùng chung.
 *
 * Cùng khuôn `viewerShellScenarios.ts`: đúng bảy kịch bản, tên nhánh lấy nguyên
 * từ `SEVEN_STATES` của `src/lib/testing/sevenStateScenarios.ts`, nhãn tiếng
 * Việt lấy nguyên từ `SEVEN_STATE_LABELS` chứ không tự đặt một bản dịch thứ hai
 * có thể trôi khỏi bản gốc.
 *
 * ## Vì sao ở đây kịch bản mang PROPS, khác `viewerShellScenarios.ts`
 *
 * Vỏ 3D dựng container vì mọi con số của nó là KẾT QUẢ của hook. Panel này thì
 * ngược lại: `PropertyInspector` là view thuần, hợp đồng của nó nói rõ "test
 * được CHỈ TỪ PROPS" (mục D), và nhiệm vụ ráp yêu cầu story dựng thẳng từ props
 * chứ không qua provider. Nên bảy kịch bản ở đây là bảy `PropertyInspectorState`
 * hoàn chỉnh.
 *
 * Điều đó KHÔNG có nghĩa là gõ tay những con số đang cần chứng minh (R-70). Mọi
 * giá trị đọc được đều lấy từ hai nguồn có sẵn:
 *
 * - **Đồ thị mẫu chuẩn của A14** (`CLEAN_BUILDING_SCENARIO` — 4 tầng, 48 tường,
 *   14 phòng, 248,60 m²): bức tường được thanh tra là tường số 14 của chính bộ
 *   mẫu ấy, nên mã đối tượng, độ dày 220 mm, chiều dài và chiều cao đều là số
 *   thật của bộ mẫu.
 * - **`toWallViewModel`** (`src/lib/viewmodel`): chiều dài, chiều cao và số ô mở
 *   đi qua đúng lớp định dạng mà hook dùng, nên dấu phẩy thập phân và đơn vị là
 *   của A15 chứ không phải của file này.
 *
 * Chữ thì lấy từ `PROPERTY_INSPECTOR_TEXT` của chính hook — một bài kiểm chép
 * lại chữ của mã nguồn chỉ chứng minh hai bản chép giống nhau.
 */

import { CLEAN_BUILDING_SCENARIO } from '@/lib/testing/fixtures';
import { SEVEN_STATE_LABELS, type SevenState } from '@/lib/testing/sevenStateScenarios';
import { toWallViewModel } from '@/lib/viewmodel/toViewModel';
import type { ViewAttribute } from '@/lib/viewmodel/types';
import { formatNumber, formatPercent } from '@/lib/format/number';
import type { Wall } from '@/domain/spatial/types';

import { NO_SAVE_TARGET_REASON } from './propertyInspectorGateway';
import { PROPERTY_INSPECTOR_TEXT } from './usePropertyInspector';
import {
  COLLAPSIBLE_GROUP_ID,
  PROPERTY_GROUP_IDS,
  PROPERTY_GROUP_LABELS,
  type PropertyGroup,
  type PropertyGroupId,
  type PropertyInspectorPanelContent,
  type PropertyInspectorState,
  type PropertyRow,
  type PropertyRowOption,
  type PropertyValue,
} from './propertyInspectorTypes';

const TEXT = PROPERTY_INSPECTOR_TEXT;

/* -------------------------------------------------------------------------- */
/* Nguyên liệu: đúng một bức tường của bộ mẫu chuẩn A14.                       */
/* -------------------------------------------------------------------------- */

/**
 * Chỉ số của bức tường được thanh tra trong bộ mẫu.
 *
 * Đặc tả nghiệm thu gọi nó là "#W-014"; bộ mẫu chuẩn đánh mã tường theo khuôn
 * `W-WALL……0`, nên bức tường thứ 14 của bộ mẫu là đối tượng tương ứng. Mã thật
 * đọc ra ở {@link INSPECTED_WALL}`.id` chứ không gõ lại ở đây.
 */
export const INSPECTED_WALL_INDEX = 14;

/** Bức tường được thanh tra, lấy thẳng từ bộ mẫu chuẩn A14. */
export const INSPECTED_WALL: Wall = (() => {
  const wall = CLEAN_BUILDING_SCENARIO.graph.walls[INSPECTED_WALL_INDEX];

  if (wall === undefined) {
    throw new Error('Bộ mẫu chuẩn A14 có ít tường hơn số kịch bản này cần.');
  }

  return wall;
})();

/** Ba bức tường cho kịch bản chọn nhiều — cùng bộ mẫu, ba mã khác nhau. */
export const MULTI_SELECTED_WALLS: readonly Wall[] = CLEAN_BUILDING_SCENARIO.graph.walls.slice(
  INSPECTED_WALL_INDEX,
  INSPECTED_WALL_INDEX + 3,
);

const WALL_ATTRIBUTES: readonly ViewAttribute[] = toWallViewModel(INSPECTED_WALL).attributes;

/** Một thuộc tính của viewmodel, đọc theo nhãn — cùng cách hook đọc nó. */
function attribute(label: string): ViewAttribute {
  const found = WALL_ATTRIBUTES.find((candidate) => candidate.label === label);

  if (found === undefined) {
    throw new Error(`Viewmodel của tường không còn thuộc tính "${label}".`);
  }

  return found;
}

/* -------------------------------------------------------------------------- */
/* Dựng dòng.                                                                  */
/* -------------------------------------------------------------------------- */

const single = (formatted: string): PropertyValue => ({ kind: 'single', formatted });

const noop = (): void => {
  /* Kịch bản là dữ liệu tĩnh: callback có mặt để view gắn được, không để chạy. */
};

/** Ba độ dày chuẩn của SegmentedControl, ô màu theo token (A1). */
const THICKNESS_OPTIONS: readonly PropertyRowOption[] = [
  { value: '110', label: `110 ${TEXT.units.millimetre}`, colorToken: '--wall-thickness-110' },
  { value: '220', label: `220 ${TEXT.units.millimetre}`, colorToken: '--wall-thickness-220' },
  { value: '330', label: `330 ${TEXT.units.millimetre}`, colorToken: '--wall-thickness-330' },
];

const WALL_KIND_OPTIONS: readonly PropertyRowOption[] = [
  { value: 'loadBearing', label: TEXT.wallType.loadBearing },
  { value: 'partition', label: TEXT.wallType.partition },
  { value: 'envelope', label: TEXT.wallType.envelope },
];

interface RowSeed {
  readonly groupId: PropertyGroupId;
  readonly row: PropertyRow;
}

/** Độ dày thật của bức tường mẫu, đã định dạng theo A15. */
export const INSPECTED_WALL_THICKNESS_TEXT = formatNumber(INSPECTED_WALL.thicknessMm, {
  fractionDigits: 0,
});

/**
 * Năm trường mặc định của tường (`DEFAULT_WALL_FIELD_IDS`) cộng dòng quan hệ
 * "Số ô mở" và lối sang màn luật — đúng bộ dòng `usePropertyInspector` dựng cho
 * một bức tường, đúng thứ tự nhóm.
 */
function wallRowSeeds(): readonly RowSeed[] {
  const length = attribute('Chiều dài');
  const height = attribute('Chiều cao');
  const openings = attribute('Ô mở');

  return [
    {
      groupId: 'geometry',
      row: {
        id: 'thickness',
        label: TEXT.fields.wall.thickness,
        controlType: 'segmented',
        value: single(INSPECTED_WALL_THICKNESS_TEXT),
        unit: TEXT.units.millimetre,
        isLocked: false,
        options: THICKNESS_OPTIONS,
        onChange: noop,
      },
    },
    {
      groupId: 'geometry',
      row: {
        id: 'length',
        label: TEXT.fields.wall.length,
        controlType: 'readonly',
        value: single(length.value),
        unit: length.unit,
        isLocked: true,
      },
    },
    {
      groupId: 'geometry',
      row: {
        id: 'height',
        label: TEXT.fields.wall.height,
        controlType: 'readonly',
        value: single(height.value),
        unit: height.unit,
        isLocked: true,
      },
    },
    {
      groupId: 'material',
      row: {
        id: 'wallType',
        label: TEXT.fields.wall.wallType,
        controlType: 'select',
        value: single(TEXT.wallType[INSPECTED_WALL.kind]),
        isLocked: false,
        options: WALL_KIND_OPTIONS,
        onChange: noop,
      },
    },
    {
      groupId: 'material',
      row: {
        id: 'isInterior',
        label: TEXT.fields.wall.isInterior,
        controlType: 'toggle',
        value: single(INSPECTED_WALL.kind === 'envelope' ? TEXT.value.no : TEXT.value.yes),
        isLocked: true,
        isChecked: INSPECTED_WALL.kind !== 'envelope',
      },
    },
    {
      groupId: 'relations',
      row: {
        id: 'openingCount',
        label: TEXT.fields.wall.openingCount,
        controlType: 'readonly',
        value: single(openings.value),
        isLocked: true,
      },
    },
    {
      groupId: 'inspection',
      row: {
        id: 'openRuleScreen',
        label: TEXT.inspection.openRuleScreen,
        controlType: 'link',
        value: single(TEXT.inspection.clean),
        isLocked: true,
        linkedEntityId: INSPECTED_WALL.id,
        onNavigate: noop,
      },
    },
  ];
}

/** Năm dòng của khối gập, giống nhau ở cả bốn loại đối tượng (P6). */
function advancedRowSeeds(): readonly RowSeed[] {
  const point = (value: { readonly x: number; readonly y: number }): string =>
    `${formatNumber(value.x, { fractionDigits: 0 })} · ${formatNumber(value.y, { fractionDigits: 0 })}`;

  const rows: readonly PropertyRow[] = [
    {
      id: 'zOffset',
      label: TEXT.fields.advanced.zOffset,
      controlType: 'readonly',
      value: single(formatNumber(0, { fractionDigits: 0 })),
      unit: TEXT.units.millimetre,
      isLocked: true,
    },
    {
      id: 'startPoint',
      label: TEXT.fields.advanced.startPoint,
      controlType: 'readonly',
      value: single(point(INSPECTED_WALL.centreline.start)),
      unit: TEXT.units.millimetre,
      isLocked: true,
    },
    {
      id: 'endPoint',
      label: TEXT.fields.advanced.endPoint,
      controlType: 'readonly',
      value: single(point(INSPECTED_WALL.centreline.end)),
      unit: TEXT.units.millimetre,
      isLocked: true,
    },
    {
      id: 'sourceEntityId',
      label: TEXT.fields.advanced.sourceEntityId,
      controlType: 'readonly',
      value: single(INSPECTED_WALL.id),
      isLocked: true,
    },
    {
      id: 'confidence',
      label: TEXT.fields.advanced.confidence,
      controlType: 'readonly',
      value: single(formatPercent(INSPECTED_WALL.confidence)),
      isLocked: true,
    },
  ];

  return rows.map((row) => ({ groupId: COLLAPSIBLE_GROUP_ID, row }));
}

/** Gom các dòng thành đúng năm nhóm cố định, theo đúng thứ tự của P4. */
function groupsOf(
  seeds: readonly RowSeed[],
  isAdvancedOpen: boolean,
  onToggleExpanded: () => void,
): readonly PropertyGroup[] {
  return PROPERTY_GROUP_IDS.map((groupId) => ({
    id: groupId,
    label: PROPERTY_GROUP_LABELS[groupId],
    rows: seeds.filter((seed) => seed.groupId === groupId).map((seed) => seed.row),
    isExpanded: groupId === COLLAPSIBLE_GROUP_ID ? isAdvancedOpen : undefined,
    onToggleExpanded: groupId === COLLAPSIBLE_GROUP_ID ? onToggleExpanded : undefined,
  }));
}

/** Nội dung panel dùng chung cho bốn trạng thái có một đối tượng đang chọn. */
function contentOf(seeds: readonly RowSeed[], selectionCount: number): PropertyInspectorPanelContent {
  const isMultiple = selectionCount > 1;

  return {
    header: {
      objectKind: 'wall',
      objectKindLabel: isMultiple
        ? `Đang chọn ${formatNumber(selectionCount)} đối tượng`
        : 'Tường',
      objectCode: INSPECTED_WALL.id,
      statusBadge: { label: TEXT.status.neutral, tone: 'neutral' },
      selectionCount,
      onCopyAsTemplate: noop,
      onClose: noop,
    },
    /* Dải ảnh rỗng: không tầng nào trong repo dựng ảnh thu nhỏ cho một thực thể
     * không gian, và hợp đồng nói rõ rỗng thì dải ảnh không vẽ gì. */
    thumbnails: [],
    groups: groupsOf(seeds, false, noop),
    footer: {
      onApprove: noop,
      onSkip: noop,
      /* Kịch bản tĩnh không có phiên làm việc nào, nên chỉ báo lưu nói ra đúng
       * điều đó: chưa mở dự án và tầng thì chưa có nơi để gửi lớp không gian tới. */
      lastEditedCaption: NO_SAVE_TARGET_REASON,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/** Dòng độ dày ở kịch bản chọn nhiều: ba bức tường lệch nhau ⇒ `mixed`. */
function mixedSeeds(): readonly RowSeed[] {
  return wallRowSeeds().map((seed) =>
    seed.row.id === 'thickness'
      ? { ...seed, row: { ...seed.row, value: { kind: 'mixed' } as const, isLocked: true } }
      : seed.row.id === 'openingCount'
        ? {
            ...seed,
            row: {
              ...seed.row,
              value: { kind: 'unavailable', caption: TEXT.partial.unavailable } as const,
            },
          }
        : seed,
  );
}

/** Dòng độ dày ở kịch bản lỗi: lượt ghi vừa bị từ chối, giá trị đã quay về cũ. */
function refusedSeeds(): readonly RowSeed[] {
  return wallRowSeeds().map((seed) =>
    seed.row.id === 'thickness'
      ? {
          ...seed,
          row: {
            ...seed.row,
            warning: {
              level: 'blocking' as const,
              message: TEXT.refusal.invalidNumber,
              onRetry: noop,
            },
          },
        }
      : seed,
  );
}

/** Mọi dòng khoá cứng — vai chỉ xem (`canEdit === false`). */
function lockedSeeds(): readonly RowSeed[] {
  return [...wallRowSeeds(), ...advancedRowSeeds()].map((seed) => ({
    ...seed,
    row: { ...seed.row, isLocked: true, onChange: undefined },
  }));
}

/** Đủ bảy dòng của một bức tường cộng năm dòng khối gập. */
function fullSeeds(): readonly RowSeed[] {
  return [...wallRowSeeds(), ...advancedRowSeeds()];
}

/** Bảy kịch bản, theo đúng thứ tự và đúng tên của `SEVEN_STATES`. */
export const PROPERTY_INSPECTOR_SCENARIOS: Readonly<Record<SevenState, PropertyInspectorState>> =
  Object.freeze({
    /** 1. Chưa chọn gì: biểu tượng nét, một câu đầy, gợi ý phím Tab. */
    empty: { kind: 'empty', message: TEXT.empty.message, tabHint: TEXT.empty.tabHint },

    /** 2. Đang tải: chỉ có dòng khung xương, không chữ nào. */
    loading: { kind: 'loading' },

    /** 3. Một phần: ba bức tường, độ dày lệch nhau ⇒ dấu gạch ngang, không phải 220. */
    partial: { kind: 'partial', ...contentOf(mixedSeeds(), MULTI_SELECTED_WALLS.length) },

    /** 4. Lỗi: lượt ghi độ dày bị từ chối, lý do và nút thử lại nằm ngay tại dòng. */
    error: { kind: 'error', erroredRowId: 'thickness', ...contentOf(refusedSeeds(), 1) },

    /** 5. Xong: một bức tường của bộ mẫu, đủ trường, không cảnh báo chặn. */
    success: { kind: 'success', ...contentOf(fullSeeds(), 1) },

    /** 6. Không có quyền: mọi dòng chỉ đọc, vẫn sao chép được. */
    forbidden: { kind: 'forbidden', ...contentOf(lockedSeeds(), 1) },

    /** 7. Thu gọn: thẻ phụ — biến thể duy nhất hook sinh ra được (không có hook truy vấn media). */
    collapsed: {
      kind: 'collapsed',
      variant: 'chip',
      summaryLabel: `Tường ${INSPECTED_WALL.id}`,
      onExpand: noop,
    },
  });

/** Bảy trạng thái theo thứ tự, cho vòng lặp của bài kiểm và của story. */
export const PROPERTY_INSPECTOR_STATE_NAMES: readonly SevenState[] = Object.freeze([
  'empty',
  'loading',
  'partial',
  'error',
  'success',
  'forbidden',
  'collapsed',
]);

/** Nhãn tiếng Việt của một trạng thái, cho thông điệp hỏng người đọc được. */
export const stateLabel = (state: SevenState): string => SEVEN_STATE_LABELS[state];
