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

const MM_PER_INCH = 25.4;
/** Hai tỷ lệ in thường gặp và hai DPI quét thường gặp của bảng đối chiếu. */
const REFERENCE_RATIOS = [50, 100] as const;
const REFERENCE_DPIS = [300, 150] as const;
/**
 * Dung sai kiểm chéo: 2 px của ảnh, theo demo đã duyệt.
 * ponytail: ngưỡng cố định ở FE; khi BE/M-02 trả dung sai theo độ phân giải thì đọc số đó.
 */
const TOLERANCE_PX = 2;

export type ScaleSource = 'proposed' | 'stored' | 'provisional';
export type ScaleCheckTone = 'verified' | 'attention' | 'neutral';

export interface KnownDimension {
  readonly realLength: number;
  readonly pixelLength: number;
}

export interface ScaleCheckInput {
  readonly mmPerPx: number | null;
  readonly source: ScaleSource | null;
  readonly shortEdgePx: number | null;
  readonly knownDimension: KnownDimension | null;
}

export interface ScaleCheckViewModel {
  readonly status: { readonly tone: ScaleCheckTone; readonly label: string; readonly sentence: string };
  readonly title: string;
  /** "24,878" — đơn vị "mm/px" do view đặt cạnh, số to. `null` khi chưa có tỷ lệ. */
  readonly densityValue: string | null;
  /** "≈ 1:70 ở 72 DPI". */
  readonly ratioLine: string | null;
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
  provisional: 'Tỷ lệ tạm',
};

const MISSING_KNOWN =
  'Chưa có kích thước đã biết để kiểm chéo: máy chưa đọc được chuỗi kích thước nào trên bản vẽ này.';

function statusOf(
  input: ScaleCheckInput,
  densityLabel: string,
  ratio: string | null,
  knownTone: 'verified' | 'attention' | null,
): ScaleCheckViewModel['status'] {
  const withRatio = ratio === null ? `${densityLabel} mm/px` : `${densityLabel} mm/px ${ratio}`;

  switch (input.source) {
    case 'proposed':
      return { tone: 'neutral', label: 'Đang đo, chưa áp dụng', sentence: `Đo được ${withRatio}, bấm Áp dụng để dùng.` };
    case 'stored':
      return knownTone === 'attention'
        ? { tone: 'attention', label: 'Đã đặt, lệch kích thước', sentence: `Đang dùng ${withRatio}. Kiểm lại kích thước đã biết bên phải.` }
        : { tone: 'verified', label: 'Đã đặt', sentence: `Đang dùng ${withRatio}.` };
    case 'provisional':
      return { tone: 'attention', label: 'Tỷ lệ tạm, chưa xác nhận', sentence: `Đang tạm dùng ${withRatio}. Đo 2 điểm để xác nhận.` };
    default:
      return { tone: 'neutral', label: 'Chưa đặt tỷ lệ', sentence: 'Đo 2 điểm trên một kích thước đã biết rồi bấm Áp dụng.' };
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
      ? `≈ ${formatDrawingScaleRatio(mmPerPx, shortEdgePx)} ở ${dpiLabel}`
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

  return {
    status: statusOf(input, densityValue ?? '', hasScale ? ratioLine : null, knownCheck?.tone ?? null),
    title: input.source === null ? 'Tỷ lệ' : TITLES[input.source],
    densityValue,
    ratioLine,
    dpiNote:
      hasEdge && dpiLabel !== null
        ? `Cạnh ngắn ảnh ${formatNumber(shortEdgePx, { fractionDigits: 0 })} px trên khổ A3 (${String(A3_SHORT_EDGE_MM)} mm) ≈ ${dpiLabel}.`
        : null,
    knownCheck,
    knownCheckMissing: hasScale && knownCheck === null ? MISSING_KNOWN : null,
    table,
  };
}
