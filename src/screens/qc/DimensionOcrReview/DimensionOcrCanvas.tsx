/**
 * Canvas trái của màn QC "Đọc kích thước OCR" — nửa 60% đối chiếu bản vẽ gốc
 * với 34 chuỗi kích thước OCR đọc được, mỗi chuỗi vẽ đúng kiểu bản vẽ kiến
 * trúc: đường gióng, hai đầu tick, số ở giữa.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng {@link DimensionOcrCanvasProps}
 * (T3 khoá ở `dimensionOcrTypes.ts`), không `@/api`, không `@/store`, không
 * `@/domain`, không `@/lib/http`. **Không một phép hình học nào ở đây** — hai
 * đầu chuỗi (`startPx`/`endPx`), hộp bao (`boundsPx`) và vị trí nhãn
 * (`labelPositionPx`) tới nơi ĐÃ TÍNH SẴN; tick hai đầu là một glyph 45° CỐ
 * ĐỊNH đặt bằng cách cộng/trừ một hằng số pixel vào toạ độ đã cho — không suy
 * góc, không chuẩn hoá vector, không chia cho độ dài đoạn.
 *
 * Năm quyết định điều phối viên đã chốt qua `orca orchestration ask` (dispatch
 * ban đầu bị thu hồi giữa chừng, câu trả lời tới trực tiếp trong phiên):
 * 1-3. KHÔNG gọi `<MeasurementLabel>` cho 34 chuỗi: nó tô cứng
 *      `dimensionStrokeToken() === 'var(--accent)'` cho cả đường lẫn tick —
 *      dùng cho mọi chuỗi (kể cả chưa chọn) thì phá A2 ("màu nhấn chỉ dành cho
 *      thứ tương tác được/đang chọn") và phá yêu cầu 6 (ba màu trạng thái);
 *      pill giá trị của nó cũng tô cứng `font-mono`, phá yêu cầu 3 ("chữ đều,
 *      không phải mono"). File này tự vẽ SVG thuần cho đường/tick/số, lấy màu
 *      từ ba token cục bộ bên dưới.
 * 4. Viền chọn 2px `--accent` (yêu cầu 5) vẽ bằng `<rect>` SVG thuần, KHÔNG
 *    qua `SelectionHalo` — component đó tô cứng 1,5px cho `variant="selected"`
 *    nên không ra đúng 2px; đây không phải một khác biệt cần "QĐ" như QĐ-2 (số
 *    260 ms thay 240 ms vì 240 không tồn tại trong thang) — 2px không vi phạm
 *    luật nào, component sẵn có chỉ đơn giản không vẽ được đúng số đó.
 * 5. `ZoomCluster` giữ nguyên qua `useZoomCluster` nội bộ của chính nó — không
 *    gọi tay `useZoomCluster()` ở đây, không có prop viewport/zoom nào trong
 *    {@link DimensionOcrCanvasProps} để mà nối; cụm nút zoom tự quản trạng
 *    thái của nó, thuần trang trí ở màn này.
 *
 * `SelectionHalo` không dùng: điều phối viên cho phép "nếu thấy hợp" cho
 * trạng thái hover, nhưng {@link DimensionOcrCanvasProps} không có
 * `hoveredDimensionId`/`onHover` nào trong hợp đồng T3 đã khoá — không có gì
 * để nuôi biến thể hover của nó, nên không hợp.
 */

import { cn } from '@/lib/utils';
import { ZoomCluster } from '@/components/canvas/ZoomCluster';

import { DIMENSION_OCR_TEXT } from './dimensionOcrText';
import type { DimensionChainViewModel, DimensionOcrCanvasProps } from './dimensionOcrTypes';

/* -------------------------------------------------------------------------- */
/* Token màu — thay `--data-dimension` (không tồn tại), theo kết luận T2.      */
/* -------------------------------------------------------------------------- */

/** Hộp bao mặc định / chuỗi chưa duyệt. */
const BORDER_DEFAULT_TOKEN = 'var(--border-default)';
/** Viền 2px của chuỗi đang chọn (A2: chỉ dành cho thứ tương tác được). */
const ACCENT_TOKEN = 'var(--accent)';
/** Chuỗi đã duyệt — xanh "đã xác minh" CHỈ đánh dấu việc người duyệt (A5). */
const STATE_VERIFIED_TOKEN = 'var(--state-verified)';
/** Giá trị đọc được — chữ đều, không mono (yêu cầu 3). */
const TEXT_TOKEN = 'var(--text-primary)';

/* -------------------------------------------------------------------------- */
/* Kích thước vẽ — hằng có tên, không rải số thô rải rác (R-71).               */
/* -------------------------------------------------------------------------- */

const DEFAULT_STROKE_WIDTH_PX = 1;
const SELECTED_STROKE_WIDTH_PX = 2;
/** Nửa chiều dài của tick 45° ở hai đầu chuỗi — glyph cố định, không suy góc. */
const TICK_HALF_LENGTH_PX = 5;
const VALUE_LABEL_FONT_SIZE_PX = 13;
/** Mờ ảnh nền, cùng khuôn `WallLayerCanvas` (`BACKGROUND_IMAGE_OPACITY`). */
const BACKGROUND_IMAGE_OPACITY = 0.3;

/** Khung canvas: tối thiểu 640, bo 16, thụt 12 — cùng khuôn hai màn QC anh em. */
const CANVAS_FRAME_CLASSES =
  'relative min-h-[640px] w-full overflow-hidden rounded-[16px] border border-border-default bg-canvas-2d p-3';

const CANVAS_READ_ONLY_NOTICE_ID = 'dimension-ocr-canvas-read-only';

/* -------------------------------------------------------------------------- */
/* Một chuỗi kích thước.                                                       */
/* -------------------------------------------------------------------------- */

interface DimensionChainFigureProps {
  readonly chain: DimensionChainViewModel;
  readonly isInteractive: boolean;
  readonly onSelect: (dimensionId: string | null) => void;
}

/**
 * Một chuỗi: hộp bao 1px + đường gióng + tick 45° hai đầu + số ở giữa (chữ
 * đều). Chuỗi đã duyệt lên `--state-verified`, chưa duyệt giữ
 * `--border-default`; chuỗi đang chọn cộng thêm một `<rect>` viền 2px accent.
 */
function DimensionChainFigure({ chain, isInteractive, onSelect }: DimensionChainFigureProps) {
  const strokeToken = chain.isReviewed ? STATE_VERIFIED_TOKEN : BORDER_DEFAULT_TOKEN;

  return (
    <g
      aria-label={chain.id}
      className={cn(
        'transition-colors duration-180 motion-reduce:transition-none',
        isInteractive ? 'cursor-pointer' : 'pointer-events-none',
      )}
      onClick={
        isInteractive
          ? (event) => {
              event.stopPropagation();
              onSelect(chain.id);
            }
          : undefined
      }
      role="presentation"
    >
      <rect
        fill="none"
        height={chain.boundsPx.height}
        stroke={strokeToken}
        strokeWidth={DEFAULT_STROKE_WIDTH_PX}
        width={chain.boundsPx.width}
        x={chain.boundsPx.x}
        y={chain.boundsPx.y}
      />

      {/* Đường gióng chính, nối thẳng hai đầu chuỗi — toạ độ đã cho, không tính. */}
      <line
        stroke={strokeToken}
        strokeWidth={DEFAULT_STROKE_WIDTH_PX}
        x1={chain.startPx.x}
        x2={chain.endPx.x}
        y1={chain.startPx.y}
        y2={chain.endPx.y}
      />

      {/* Tick 45° cố định ở hai đầu — thay cho mũi tên, không suy góc theo đoạn. */}
      <line
        stroke={strokeToken}
        strokeWidth={DEFAULT_STROKE_WIDTH_PX}
        x1={chain.startPx.x - TICK_HALF_LENGTH_PX}
        x2={chain.startPx.x + TICK_HALF_LENGTH_PX}
        y1={chain.startPx.y + TICK_HALF_LENGTH_PX}
        y2={chain.startPx.y - TICK_HALF_LENGTH_PX}
      />
      <line
        stroke={strokeToken}
        strokeWidth={DEFAULT_STROKE_WIDTH_PX}
        x1={chain.endPx.x - TICK_HALF_LENGTH_PX}
        x2={chain.endPx.x + TICK_HALF_LENGTH_PX}
        y1={chain.endPx.y + TICK_HALF_LENGTH_PX}
        y2={chain.endPx.y - TICK_HALF_LENGTH_PX}
      />

      {/* Giá trị đã định dạng sẵn (A15) — chữ đều, KHÔNG font-mono (yêu cầu 3). */}
      <text
        dominantBaseline="middle"
        fill={TEXT_TOKEN}
        fontSize={VALUE_LABEL_FONT_SIZE_PX}
        textAnchor="middle"
        x={chain.labelPositionPx.x}
        y={chain.labelPositionPx.y}
      >
        {chain.valueLabel}
      </text>

      {chain.isSelected ? (
        <rect
          fill="none"
          height={chain.boundsPx.height}
          stroke={ACCENT_TOKEN}
          strokeWidth={SELECTED_STROKE_WIDTH_PX}
          width={chain.boundsPx.width}
          x={chain.boundsPx.x}
          y={chain.boundsPx.y}
        />
      ) : null}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas.                                                                     */
/* -------------------------------------------------------------------------- */

export function DimensionOcrCanvas({
  backgroundImageAlt,
  backgroundImageUrl,
  chains,
  isInteractive,
  onSelect,
}: DimensionOcrCanvasProps) {
  return (
    <div
      aria-describedby={isInteractive ? undefined : CANVAS_READ_ONLY_NOTICE_ID}
      aria-label={DIMENSION_OCR_TEXT.screen.canvasAriaLabel}
      className={CANVAS_FRAME_CLASSES}
      role="group"
    >
      <div className="absolute inset-0">
        {backgroundImageUrl === null ? (
          <div aria-hidden="true" className="absolute inset-0 bg-bg-sunken" />
        ) : (
          <img
            alt={backgroundImageAlt}
            className="pointer-events-none absolute inset-0 block h-full w-full select-none"
            draggable={false}
            src={backgroundImageUrl}
            style={{ opacity: BACKGROUND_IMAGE_OPACITY }}
          />
        )}

        <svg
          aria-label={DIMENSION_OCR_TEXT.screen.canvasAriaLabel}
          className="absolute inset-0 h-full w-full"
          role="img"
        >
          {chains.map((chain) => (
            <DimensionChainFigure
              chain={chain}
              isInteractive={isInteractive}
              key={chain.id}
              onSelect={onSelect}
            />
          ))}
        </svg>
      </div>

      <ZoomCluster />

      {isInteractive ? null : (
        <p className="sr-only" id={CANVAS_READ_ONLY_NOTICE_ID}>
          {DIMENSION_OCR_TEXT.states.forbidden.description}
        </p>
      )}
    </div>
  );
}
