/**
 * Bảy story, một cho mỗi trạng thái của A11 (R-63).
 *
 * Story dựng thẳng {@link CadBranchConfirm} — không container, không provider,
 * không cổng dữ liệu, không một lời gọi mạng nào. Đó là thứ mục D mua được: xem
 * được cả bảy trạng thái mà không phải dựng nổi một máy chủ. Cùng khuôn
 * `ScaleCalibration.stories.tsx`.
 *
 * ## Dữ liệu đến từ bộ mẫu của cổng, không bịa tại chỗ (R-70)
 *
 * Chín lớp, hình học, bảng tầng, danh sách thực thể không hỗ trợ và hai số phiên
 * bản định dạng đều lấy nguyên từ `cadBranchConfirmGateway.ts` — đúng bộ mà test
 * và cổng giả dùng. Bốn lớp đã gán vai trò của bộ mẫu cộng lại đúng **312** thực
 * thể, nên dòng tóm tắt "Đã ánh xạ 4/9 lớp · 312 đối tượng sẽ được nhập" dựng
 * lại được mà không phải viết tay con số nào.
 *
 * ## Story đứng vào chỗ hook đứng
 *
 * `CadBranchConfirmProps` là thứ hook trả về, nên story phải ghép nó — kể cả
 * phần định dạng số (A15). Nó định dạng bằng chính `@/lib/format/number` mà hook
 * dùng; đây không phải view, và view thì không bao giờ được biết tới `formatNumber`.
 *
 * ## Bẫy CSF: một export không phải story làm trắng cả file
 *
 * CSF coi MỌI export có tên là một story. Gặp một export không phải component —
 * một hằng, một hàm dựng kịch bản — Storybook ném `Cannot create property
 * 'parameters' on ...` và làm trắng cả file. Đã xảy ra trong repo này, nên mọi
 * export phụ đều có tên trong {@link meta.excludeStories}.
 */

import type { Meta, StoryObj } from '@storybook/react';

import { formatNumber } from '@/lib/format/number';
import { SEVEN_STATES, type SevenState } from '@/lib/testing/sevenStateScenarios';

import { CadBranchConfirm } from './CadBranchConfirm';
import {
  CAD_SAMPLE_ENTITIES,
  CAD_SAMPLE_FILE_FORMAT_VERSION,
  CAD_SAMPLE_FLOOR_AVAILABILITY,
  CAD_SAMPLE_LAYERS,
  CAD_SAMPLE_LAYERS_MAPPED,
  CAD_SAMPLE_UNSUPPORTED_ENTITIES,
  CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION,
  CAD_SAMPLE_WALL_THICKNESSES_MM,
} from './cadBranchConfirmGateway';
import { CAD_BRANCH_CONFIRM_TEXT, COMPARISON_TABLE } from './cadBranchConfirmText';
import type {
  CadBranchComparisonCell,
  CadBranchComparisonRowId,
  CadBranchConfirmActions,
  CadBranchConfirmDialogViewModel,
  CadBranchConfirmProps,
  CadDrawingUnit,
  CadImportOptionsViewModel,
  CadLayer,
  CadLayerRole,
  CadMappingSummary,
  CadOriginMode,
  CadPreviewExtent,
  CadSelectOption,
  CadWallThicknessLegendEntry,
} from './types';

/** Story không nối dây; mọi hành động là một hàm không làm gì. */
const NO_OP = (): void => undefined;

const ACTIONS: CadBranchConfirmActions = {
  onChooseBranch: NO_OP,
  onToggleRemember: NO_OP,
  onDismiss: NO_OP,
  onAssignRole: NO_OP,
  onHoverLayer: NO_OP,
  onHoverEntity: NO_OP,
  onChangeUnit: NO_OP,
  onChangeOrigin: NO_OP,
  onToggleImportOptions: NO_OP,
  onImportGeometry: NO_OP,
  onToggleMappingPanelCollapsed: NO_OP,
  onRetry: NO_OP,
};

/* -------------------------------------------------------------------------- */
/* Giai đoạn 1 — bảng so sánh, bảng tầng, chẩn đoán tệp.                       */
/* -------------------------------------------------------------------------- */

/** Ba dòng của bảng so sánh, theo đúng thứ tự bảng chữ của màn. */
const COMPARISON_ROW_IDS: readonly CadBranchComparisonRowId[] = ['accuracy', 'qcEffort', 'time'];

/**
 * Ba dòng so sánh, ghép từ bảng chữ của màn.
 *
 * `flatMap` chứ không `map` kèm giá trị dự phòng: hai danh sách lệch độ dài là
 * thứ phải lộ ra chứ không phải thứ được vá bằng một `rowId` đoán bừa.
 */
const COMPARISON_ROWS: readonly CadBranchComparisonCell[] = COMPARISON_ROW_IDS.flatMap(
  (rowId, index) => {
    const row = COMPARISON_TABLE[index];

    return row === undefined
      ? []
      : [
          {
            rowId,
            rowLabel: row.aspect,
            cadValueLabel: row.cadBranch,
            aiValueLabel: row.aiBranch,
          },
        ];
  },
);

const PHASE_1_TEXT = CAD_BRANCH_CONFIRM_TEXT.phase1;
const PHASE_2_TEXT = CAD_BRANCH_CONFIRM_TEXT.phase2;

/** Câu lỗi của tệp không đọc được — LUÔN nêu số phiên bản, đúng như hook nêu. */
const ERROR_MESSAGE = `không đọc được tệp CAD này: bản vẽ lưu ở phiên bản định dạng ${CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION}, mới hơn mức hệ thống đọc được. hãy xuất lại tệp ở phiên bản cũ hơn, hoặc dùng nhánh AI.`;

/** Mã máy đọc của lỗi tệp hỏng — cùng mã `describeError` phát ra cho kind `validation`. */
const ERROR_CODE = 'VALIDATION';

const EMPTY_NOTICE =
  'tệp CAD không có lớp nào được đặt tên. hệ thống sẽ ánh xạ theo loại hình học thay cho tên lớp.';

const FORBIDDEN_NOTICE =
  'bạn không có quyền chỉnh sửa lớp của dự án này, nên không chốt được nhánh xử lý. liên hệ quản trị viên để được cấp quyền.';

const SUCCESS_NOTICE = 'đã nhập xong hình học từ tệp CAD.';

/** Câu của trạng thái `partial`: tầng thiếu CAD, rồi từng loại thực thể một. */
const PARTIAL_NOTICE = `${CAD_SAMPLE_FLOOR_AVAILABILITY.filter((floor) => !floor.hasCadFile)
  .map((floor) => floor.floorName)
  .join(', ')} không có tệp CAD kèm theo, những tầng đó sẽ đi nhánh AI. không dựng lại được ${CAD_SAMPLE_UNSUPPORTED_ENTITIES.map(
  (entity) => `${entity.kind} (${formatNumber(entity.count)})`,
).join(', ')}.`;

function dialogFor(state: SevenState): CadBranchConfirmDialogViewModel {
  const isBlocked = state === 'error' || state === 'forbidden';
  const isReading = state === 'loading';

  return {
    isOpen: state === 'loading' || state === 'error' || state === 'forbidden',
    comparisonRows: COMPARISON_ROWS,
    floorAvailability: CAD_SAMPLE_FLOOR_AVAILABILITY,
    diagnostics: {
      hasMissingUnitDeclaration: !isReading,
      detectedUnit: isReading ? null : 'mm',
      fileFormatVersion: isReading
        ? ''
        : state === 'error'
          ? CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION
          : CAD_SAMPLE_FILE_FORMAT_VERSION,
      hasNamedLayers: state !== 'empty' && !isReading,
    },
    unitWarningMessage: isReading ? null : PHASE_1_TEXT.unitDeclarationWarning.message,
    isRememberChoiceChecked: false,
    isCadChoiceDisabled: isBlocked,
    cadChoiceDisabledReason: isBlocked
      ? state === 'forbidden'
        ? FORBIDDEN_NOTICE
        : ERROR_MESSAGE
      : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Giai đoạn 2 — lớp, hình học, chú giải, tuỳ chọn nhập.                       */
/* -------------------------------------------------------------------------- */

/** Bảy vai trò, đúng thứ tự Select của hook: "bỏ qua" đứng cuối vì nó là mặc định. */
const ROLE_ORDER: readonly CadLayerRole[] = [
  'wall',
  'door',
  'window',
  'dimension',
  'grid',
  'furniture',
  'ignore',
];

const ROLE_OPTIONS: readonly CadSelectOption<CadLayerRole>[] = ROLE_ORDER.map((role) => ({
  value: role,
  label: PHASE_2_TEXT.layerRoles[role]?.label ?? role,
}));

const UNIT_ORDER: readonly CadDrawingUnit[] = ['mm', 'cm', 'm', 'inch'];

const UNIT_OPTIONS: readonly CadSelectOption<CadDrawingUnit>[] = UNIT_ORDER.map((unit) => ({
  value: unit,
  label: PHASE_2_TEXT.advancedOptions.units[unit] ?? unit,
}));

const ORIGIN_OPTIONS: readonly CadSelectOption<CadOriginMode>[] = [
  { value: 'keep-cad', label: PHASE_2_TEXT.advancedOptions.originOptions.keepCAD },
  { value: 'grid-a1', label: PHASE_2_TEXT.advancedOptions.originOptions.gridA1 },
];

/**
 * Chú giải độ dày tường: tên token bảng màu, KHÔNG phải mã màu.
 *
 * Cùng ba mức `wall-110` / `wall-220` / `wall-330` mà `tailwind.config.ts` đặt
 * tên và `materialMap` tô lên canvas, đọc ra từ chính hình học của bộ mẫu — chú
 * giải kể tên mức không có trên hình là chú giải nói dối.
 */
const WALL_THICKNESS_LEGEND: readonly CadWallThicknessLegendEntry[] =
  CAD_SAMPLE_WALL_THICKNESSES_MM.map((thicknessMm) => ({
    id: `cad-wall-thickness-${formatNumber(thicknessMm, { grouping: false })}`,
    label: `${formatNumber(thicknessMm)} mm`,
    colorToken: `wall-${formatNumber(thicknessMm, { grouping: false })}`,
  }));

/**
 * Khung bao của hình học mẫu, đọc ra từ chính các điểm của nó.
 *
 * Hook tính khung bao này cho bản sản phẩm (R-61); story đứng vào chỗ hook đứng
 * nên nó đọc cùng một nguồn thay vì chép bốn con số vào đây.
 */
const SAMPLE_EXTENT_MM: CadPreviewExtent = CAD_SAMPLE_ENTITIES.reduce<CadPreviewExtent>(
  (extent, entity) =>
    entity.points.reduce<CadPreviewExtent>(
      (inner, [xMm, yMm]) => ({
        minXMm: Math.min(inner.minXMm, xMm),
        minYMm: Math.min(inner.minYMm, yMm),
        maxXMm: Math.max(inner.maxXMm, xMm),
        maxYMm: Math.max(inner.maxYMm, yMm),
      }),
      extent,
    ),
  {
    minXMm: Number.POSITIVE_INFINITY,
    minYMm: Number.POSITIVE_INFINITY,
    maxXMm: Number.NEGATIVE_INFINITY,
    maxYMm: Number.NEGATIVE_INFINITY,
  },
);

/** Khung bao khi chưa có gì để bao — bốn số không, không phải `Infinity`. */
const EMPTY_EXTENT_MM: CadPreviewExtent = { minXMm: 0, minYMm: 0, maxXMm: 0, maxYMm: 0 };

/** Lớp của trạng thái `empty`: tệp không có lớp đặt tên nào. */
const NO_LAYERS: readonly CadLayer[] = [];

/** Dòng tóm tắt, ghép đúng cách hook ghép — số qua `formatNumber`, chữ ở đây. */
function summaryOf(layers: readonly CadLayer[]): CadMappingSummary {
  const mapped = layers.filter((layer) => layer.role !== 'ignore');
  const objectCount = mapped.reduce((total, layer) => total + layer.entityCount, 0);

  return {
    mappedLayerCount: mapped.length,
    totalLayerCount: layers.length,
    objectCount,
    mappedCountLabel: `Đã ánh xạ ${formatNumber(mapped.length)}/${formatNumber(layers.length)} lớp`,
    objectCountLabel: `${formatNumber(objectCount)} đối tượng sẽ được nhập`,
  };
}

const IMPORT_OPTIONS: CadImportOptionsViewModel = {
  isExpanded: false,
  unit: 'mm',
  detectedUnit: 'mm',
  unitOptions: UNIT_OPTIONS,
  origin: 'keep-cad',
  originOptions: ORIGIN_OPTIONS,
};

/* -------------------------------------------------------------------------- */
/* Bảy kịch bản.                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Props đầy đủ của một trạng thái.
 *
 * Bảy nhánh, và `SevenState` là một union đóng — nên bỏ sót một trạng thái là
 * lỗi biên dịch ở đây, và `expectSevenStates` bắt lại lần nữa lúc chạy.
 */
export function scenarioFor(state: SevenState): CadBranchConfirmProps {
  const isStageTwo = state === 'empty' || state === 'partial' || state === 'success' || state === 'collapsed';
  const layers = state === 'empty' ? NO_LAYERS : CAD_SAMPLE_LAYERS_MAPPED;
  const entities = state === 'empty' ? [] : CAD_SAMPLE_ENTITIES;

  return {
    actions: ACTIONS,
    model: {
      state,
      stage: isStageTwo ? 'layerMapping' : 'branchDialog',
      dialog: dialogFor(state),
      mapping: isStageTwo ? { layers, roleOptions: ROLE_OPTIONS, hoveredLayerId: null } : null,
      preview: isStageTwo
        ? {
            layers,
            hoveredLayerId: null,
            hoveredEntityId: null,
            entities,
            extentMm: state === 'empty' ? EMPTY_EXTENT_MM : SAMPLE_EXTENT_MM,
            wallThicknessLegend: state === 'empty' ? [] : WALL_THICKNESS_LEGEND,
            isLoading: false,
          }
        : null,
      importOptions: isStageTwo ? IMPORT_OPTIONS : null,
      summary: isStageTwo ? summaryOf(layers) : null,
      unsupportedEntityKinds: state === 'partial' ? CAD_SAMPLE_UNSUPPORTED_ENTITIES : [],
      isMappingPanelCollapsed: state === 'collapsed',
      canImportGeometry: state === 'partial' || state === 'collapsed',
      isImporting: false,
      prefersReducedMotion: false,
      errorMessage: state === 'error' ? ERROR_MESSAGE : null,
      errorCode: state === 'error' ? ERROR_CODE : null,
      errorFileFormatVersion: state === 'error' ? CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION : null,
      emptyNotice: state === 'empty' ? EMPTY_NOTICE : null,
      partialNotice: state === 'partial' ? PARTIAL_NOTICE : null,
      forbiddenNotice: state === 'forbidden' ? FORBIDDEN_NOTICE : null,
      successNotice: state === 'success' ? SUCCESS_NOTICE : null,
    },
  };
}

/** Bảy kịch bản, dựng sẵn — test dùng chính bộ này, không dựng bộ thứ hai (R-70). */
export const SEVEN_SCENARIOS: readonly CadBranchConfirmProps[] = SEVEN_STATES.map(scenarioFor);

/** Hộp thoại đã đóng mà chưa chốt nhánh: khối bàn giao nhánh AI hiện ra. */
export function branchHandoffScenario(): CadBranchConfirmProps {
  const base = scenarioFor('partial');

  return {
    ...base,
    model: {
      ...base.model,
      stage: 'branchDialog',
      dialog: { ...base.model.dialog, isOpen: false },
      mapping: null,
      preview: null,
      importOptions: null,
      summary: null,
    },
  };
}

/** Giảm chuyển động: con số tóm tắt không chạy, nó chỉ LÀ giá trị của nó (mục B). */
export function reducedMotionScenario(): CadBranchConfirmProps {
  const base = scenarioFor('partial');

  return { ...base, model: { ...base.model, prefersReducedMotion: true } };
}

/**
 * Từ máy đọc mà `expectVietnamese` phải bỏ qua: tên lớp CAD, tên loại thực thể,
 * số phiên bản định dạng. Đọc ra từ chính bộ mẫu, không liệt kê lần thứ hai.
 */
export const CAD_MACHINE_WORDS: readonly string[] = [
  ...CAD_SAMPLE_LAYERS.flatMap((layer) => layer.name.split('-')),
  ...CAD_SAMPLE_UNSUPPORTED_ENTITIES.flatMap((entity) => entity.kind.split('_')),
  CAD_SAMPLE_FILE_FORMAT_VERSION,
  CAD_SAMPLE_UNSUPPORTED_FILE_FORMAT_VERSION,
];

/* -------------------------------------------------------------------------- */
/* Storybook.                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `excludeStories` KHÔNG phải chuyện gọn gàng, nó là sửa lỗi: CSF coi mọi export
 * có tên là một story, và một export không phải component làm trắng cả file.
 */
const meta = {
  title: 'Màn hình/Phát hiện tệp CAD',
  component: CadBranchConfirm,
  parameters: { layout: 'fullscreen' },
  excludeStories: [
    'CAD_MACHINE_WORDS',
    'SEVEN_SCENARIOS',
    'branchHandoffScenario',
    'reducedMotionScenario',
    'scenarioFor',
  ],
} satisfies Meta<typeof CadBranchConfirm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rong: Story = { args: scenarioFor('empty') };

export const DangTai: Story = { args: scenarioFor('loading') };

export const MotPhan: Story = { args: scenarioFor('partial') };

export const Loi: Story = { args: scenarioFor('error') };

export const Xong: Story = { args: scenarioFor('success') };

export const KhongCoQuyen: Story = { args: scenarioFor('forbidden') };

export const ThuGon: Story = { args: scenarioFor('collapsed') };
