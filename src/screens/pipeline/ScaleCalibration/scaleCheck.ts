/**
 * Phép tính hiển thị thuần cho khối "Kiểm tra con số" của màn Đặt tỷ lệ (S-11).
 *
 * Chỉ dùng số app đã có: mm/px đang dùng, cạnh ngắn ảnh (px), khổ giấy A3 mà cả hệ
 * ngưỡng chất lượng neo vào (`A3_SHORT_EDGE_MM`), và một chuỗi kích thước OCR nếu có.
 * Không đoán DPI từ metadata (BE chưa trả) — DPI ở đây là DPI SUY RA từ khổ A3.
 *
 * Một nguồn trạng thái: chip, câu trạng thái và dòng kiểm chéo đều sinh từ
 * {@link buildScaleCheck}, nên panel trái và panel phải không nói hai kiểu.
 */

import { A3_SHORT_EDGE_MM, formatDrawingScaleRatio } from '@/lib/format/measure';
import { formatNumber } from '@/lib/format/number';
import { millimetres, millimetresToMetres } from '@/domain/units/types';
import { SCALE_STATE_VIEWS } from '@/lib/viewmodel/provisionalScale';

const MM_PER_INCH = 25.4;
/** Hai tỷ lệ in thường gặp và hai DPI quét thường gặp của bảng đối chiếu. */
const REFERENCE_RATIOS = [50, 100] as const;
const REFERENCE_DPIS = [300, 150] as const;
/**
 * Dung sai kiểm chéo: 2 px của ảnh, theo demo đã duyệt.
 * ponytail: ngưỡng cố định ở FE; khi BE/M-02 trả dung sai theo độ phân giải thì đọc số đó.
 */
const TOLERANCE_PX = 2;

/** `missing` = tầng máy không đo được tỷ lệ (N16 `project_default`), số đang dùng là mặc định dự án. */
export type ScaleSource = 'proposed' | 'stored' | 'provisional' | 'missing';
export type ScaleCheckTone = 'verified' | 'attention' | 'violation' | 'neutral';

export interface KnownDimension {
  readonly realLength: number;
  readonly pixelLength: number;
}

/** Cỡ căn (hộp bao tường) theo tỷ lệ đang xét, bằng mm. */
export interface PlanSizeMm {
  readonly widthMm: number;
  readonly heightMm: number;
}

export interface ScaleCheckInput {
  readonly mmPerPx: number | null;
  readonly source: ScaleSource | null;
  readonly shortEdgePx: number | null;
  readonly knownDimension: KnownDimension | null;
  /** K17: có thì số to là cỡ căn thật để soi bằng mắt; mm/px và 1:N lùi xuống dòng chi tiết. */
  readonly planSizeMm?: PlanSizeMm | null;
}

export interface ScaleCheckViewModel {
  readonly status: { readonly tone: ScaleCheckTone; readonly label: string; readonly sentence: string };
  readonly title: string;
  /** "24,878" — đơn vị "mm/px" do view đặt cạnh, số to. `null` khi chưa có tỷ lệ. */
  readonly densityValue: string | null;
  /** "≈ 1:70 ở 72 DPI". */
  readonly ratioLine: string | null;
  /** Số to của khối tỷ lệ: cỡ căn "≈ 9,1 × 7,4 m" khi biết, không thì `ratioLine`. */
  readonly headline: string | null;
  /** Dòng chi tiết dưới số to khi số to là cỡ căn: "13,915 mm/px · ≈ 1:36 nếu ảnh là khổ A3". */
  readonly detailLine: string | null;
  /** "Cạnh ngắn ảnh 837 px trên khổ A3 (297 mm) ≈ 72 DPI." */
  readonly dpiNote: string | null;
  readonly knownCheck: { readonly tone: 'verified' | 'attention'; readonly title: string; readonly detail: string } | null;
  readonly knownCheckMissing: string | null;
  readonly table: {
    readonly headers: readonly string[];
    readonly rows: readonly { readonly ratio: string; readonly cells: readonly string[] }[];
  } | null;
}

const mm = (value: number): string => formatNumber(Math.round(value), { fractionDigits: 0 });
const density = (value: number): string =>
  formatNumber(value, { maxFractionDigits: value > 0 && value < 1 ? 6 : 3 });

/** DPI suy ra khi coi cạnh ngắn ảnh là cạnh ngắn khổ A3. */
export function inferredDpi(shortEdgePx: number): number {
  return (shortEdgePx * MM_PER_INCH) / A3_SHORT_EDGE_MM;
}

/** mm thật trên 1 px khi bản vẽ tỷ lệ 1:N được quét ở `dpi`. */
export function mmPerPxAt(ratio: number, dpi: number): number {
  return (ratio * MM_PER_INCH) / dpi;
}

const TITLES: Readonly<Record<ScaleSource, string>> = {
  proposed: 'Tỷ lệ vừa đo',
  stored: 'Tỷ lệ đã đặt',
  provisional: 'Tỷ lệ máy đo',
  missing: 'Tỷ lệ mặc định',
};

/** UX-R2 K27: cỡ căn theo tỷ lệ mặc định là số sai, nói thẳng ra. */
const MISSING_SIZE_SUFFIX = ' (chắc chắn sai)';

const { check: CHECK, missing: MISSING } = SCALE_STATE_VIEWS;

const MISSING_KNOWN = 'Chưa có kích thước thứ hai để kiểm chéo tỷ lệ.';

const metres = (valueMm: number): string => formatNumber(millimetresToMetres(millimetres(valueMm)), { fractionDigits: 1 });
export const planSizeText = (size: PlanSizeMm): string => `≈ ${metres(size.widthMm)} × ${metres(size.heightMm)} m`;

/**
 * UX41 U34: cỡ căn vô lý cho một căn hộ — cạnh dài hơn `maxMm` (thường do thừa một số 0) hoặc
 * ngắn hơn `minMm`. Hai ngưỡng truyền vào để nơi gọi giữ một nguồn hằng số.
 */
export function isPlanSizeImplausible(size: PlanSizeMm, minMm: number, maxMm: number): boolean {
  const longest = Math.max(size.widthMm, size.heightMm);
  return longest > maxMm || longest < minMm;
}

function statusOf(
  input: ScaleCheckInput,
  densityLabel: string,
  ratio: string | null,
  knownTone: 'verified' | 'attention' | null,
  sizeText: string | null,
): ScaleCheckViewModel['status'] {
  // K17: người dùng soi được cỡ căn thật, không soi được 1:N suy từ khổ A3.
  const withRatio = sizeText === null ? `tỷ lệ ${ratio ?? `${densityLabel} mm/px`}` : `tỷ lệ cho căn ${sizeText}`;

  switch (input.source) {
    // UX-R2 K05/K50: câu trạng thái chỉ nói tình hình; lời dẫn duy nhất nằm ở dải trên bản vẽ.
    case 'proposed':
      return { tone: 'neutral', label: 'Chưa xác nhận', sentence: `Đo được ${withRatio}.` };
    case 'stored':
      return knownTone === 'attention'
        ? { tone: 'attention', label: 'Đã xác nhận, lệch kích thước', sentence: `Đang dùng ${withRatio}. Kiểm lại kích thước đã biết bên phải.` }
        : { tone: 'verified', label: 'Đã xác nhận', sentence: `Đang dùng ${withRatio}.` };
    case 'provisional':
      // Tên + màu trạng thái dùng chung mọi màn (`SCALE_STATE_VIEWS`).
      return { tone: CHECK.statusCode, label: CHECK.name, sentence: `Đang tạm dùng ${withRatio}.` };
    case 'missing':
      return { tone: MISSING.statusCode, label: MISSING.name, sentence: 'Máy không đo được tỷ lệ, cỡ căn hiện tại chắc chắn sai.' };
    default:
      return { tone: MISSING.statusCode, label: MISSING.name, sentence: 'Tầng này chưa có tỷ lệ.' };
  }
}

export function buildScaleCheck(input: ScaleCheckInput): ScaleCheckViewModel {
  const { mmPerPx, shortEdgePx, knownDimension } = input;
  const hasScale = mmPerPx !== null && mmPerPx > 0 && input.source !== null;
  const hasEdge = shortEdgePx !== null && shortEdgePx > 0;
  const dpi = hasEdge ? inferredDpi(shortEdgePx) : null;
  const dpiLabel = dpi === null ? null : `${formatNumber(dpi, { fractionDigits: 0 })} DPI`;

  const densityValue = hasScale ? density(mmPerPx) : null;
  const ratioLine =
    hasScale && hasEdge && dpiLabel !== null
      ? `≈ ${formatDrawingScaleRatio(mmPerPx, shortEdgePx)}`
      : null;

  let knownCheck: ScaleCheckViewModel['knownCheck'] = null;
  if (hasScale && knownDimension !== null && knownDimension.pixelLength > 0) {
    const measured = knownDimension.pixelLength * mmPerPx;
    const delta = measured - knownDimension.realLength;
    const ok = Math.abs(delta) <= TOLERANCE_PX * mmPerPx;
    knownCheck = {
      tone: ok ? 'verified' : 'attention',
      title: `Đo ra ${mm(measured)} mm, bản vẽ ghi ${mm(knownDimension.realLength)}`,
      detail: ok
        ? `Lệch ${mm(Math.abs(delta))} mm, trong sai số ${String(TOLERANCE_PX)} px (${mm(TOLERANCE_PX * mmPerPx)} mm).`
        : `Lệch ${mm(Math.abs(delta))} mm, quá sai số ${String(TOLERANCE_PX)} px. Đo lại hoặc kiểm số đã nhập.`,
    };
  }

  const table =
    dpi === null || dpiLabel === null
      ? null
      : {
          headers: [...REFERENCE_DPIS.map((value) => `${String(value)} DPI`), `${dpiLabel}, ảnh này`],
          rows: REFERENCE_RATIOS.map((ratio) => ({
            ratio: `1:${String(ratio)}`,
            cells: [...REFERENCE_DPIS, dpi].map((value) => formatNumber(mmPerPxAt(ratio, value), { fractionDigits: 1 })),
          })),
        };

  const sizeText = hasScale && input.planSizeMm != null ? planSizeText(input.planSizeMm) : null;
  // UX-R2 K27: bỏ "≈ 1:N nếu ảnh là khổ A3" — con số đoán khổ giấy không giúp người dùng quyết gì.
  const detailLine = sizeText === null || densityValue === null ? null : `${densityValue} mm/px`;
  const headline =
    sizeText !== null && input.source === 'missing' ? `${sizeText}${MISSING_SIZE_SUFFIX}` : (sizeText ?? ratioLine);

  return {
    status: statusOf(input, densityValue ?? '', hasScale ? ratioLine : null, knownCheck?.tone ?? null, sizeText),
    title: input.source === null ? 'Tỷ lệ' : sizeText === null ? TITLES[input.source] : `Cỡ căn theo ${TITLES[input.source].toLowerCase()}`,
    densityValue,
    ratioLine,
    headline,
    detailLine,
    dpiNote:
      hasEdge && dpiLabel !== null
        ? `Cạnh ngắn ảnh ${formatNumber(shortEdgePx, { fractionDigits: 0 })} px trên khổ A3 (${String(A3_SHORT_EDGE_MM)} mm) ≈ ${dpiLabel}.`
        : null,
    knownCheck,
    knownCheckMissing: hasScale && knownCheck === null ? MISSING_KNOWN : null,
    table,
  };
}
