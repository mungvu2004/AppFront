/**
 * Ba lớp thị giác của canvas Đối chiếu bản vẽ, và bộ lọc ngưỡng biến ảnh quét
 * thành nét thuần.
 *
 * Tách khỏi `OverlayComparisonCanvas.tsx` vì trần 400 dòng của R-22, không phải
 * vì chúng dùng lại được ở đâu khác: ba thành phần dưới đây chỉ có nghĩa bên
 * trong khung đối chiếu. Chúng là phần con của một view, cùng tiền tố
 * `OverlayComparisonCanvas*`, chứ không phải "component mới" theo nghĩa bị cấm.
 *
 * ## Đúng ba lớp, và đúng ba màu
 *
 * `OverlayLayerId` là union đóng `'scan' | 'geometry' | 'deviation'`, nên số lớp
 * được ép ở tầng kiểu. Bảng màu đóng theo: `--text-primary` cho nét quét,
 * `--accent` cho hình học và cho thứ đang được chọn (A2), `--state-attention`
 * cho gạch chéo. Không có màu thứ tư, không bản đồ nhiệt, không thang cầu vồng —
 * kể cả một đường viền "trung tính" cho vùng trong dung sai, vì đó chính là cách
 * một bảng màu ba token âm thầm thành bốn.
 *
 * ## Vì sao ảnh quét đi qua một bộ lọc SVG chứ không phải `opacity`
 *
 * Đặc tả: ảnh nguồn là **nét thuần**, không bao giờ là ảnh raster tô đầy. Hạ
 * `opacity` một tấm ảnh quét vẫn để lại nền giấy — một mảng xám phủ kín khung,
 * đúng thứ bị cấm. `mask-image` cũng không giải được: `mask-mode: luminance` giữ
 * chỗ SÁNG, tức giữ nền giấy và bỏ nét mực, ngược hẳn điều cần.
 *
 * Nên nét được tách bằng một bộ lọc ngưỡng thật, {@link ScanInkFilter}:
 *
 * 1. `feColorMatrix` đặt alpha `= 1 − 0,33·(R+G+B)`, tức **độ tối** của điểm
 *    ảnh — giấy trắng ra alpha ≈ 0, mực đen ra alpha = 1;
 * 2. `feFuncA type="discrete"` cắt ngưỡng ở giữa: tối hơn xám trung tính thì
 *    thành nét, sáng hơn thì biến mất hẳn. Đây là chỗ "tô đầy" bị loại bỏ — sau
 *    bước này không còn giá trị trung gian nào để phủ nền;
 * 3. `feFlood` + `feComposite operator="in"` tô phần alpha còn lại bằng
 *    `currentColor`, tức `--text-primary` do lớp cha đặt. Đó là cách một token
 *    màu đi vào một bộ lọc SVG mà không ai phải viết mã màu ra (A1) —
 *    `currentColor` không phải hex, rgb hay hsl.
 *
 * Độ mờ của lớp vẫn do `layers.scan.opacity` quyết định. Nó làm nét nhạt đi,
 * không làm nền hiện lại, vì nền đã không còn tồn tại sau bước 2.
 */

import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

import type {
  DeviationMarkViewModel,
  GeometryPolyline,
  OverlayLayerViewModel,
} from './types';

/* -------------------------------------------------------------------------- */
/* Hằng số.                                                                    */
/* -------------------------------------------------------------------------- */

/** Tỉ lệ `0..1` sang phần trăm CSS. Phép nhân giao diện, không phải quy đổi đơn vị. */
const PERCENT = 100;

/**
 * Ba nhịp rồi giữ tĩnh, theo đặc tả.
 *
 * Số nhịp là một phép **đếm**, không phải một thời lượng, nên R-71 không đụng
 * tới nó. Thời lượng của mỗi nhịp thì có, và nó xuống đây từ `MOTION_DURATIONS_MS`
 * qua `pulseDuration`.
 */
export const TOLERANCE_PULSE_BEATS = 3;

/** Gạch chéo 45°, một nét mảnh mỗi 6px. Màu duy nhất được phép cho lớp lệch. */
const HATCH_IMAGE =
  'repeating-linear-gradient(45deg, var(--state-attention) 0 1px, transparent 1px 6px)';

/** Nét hình học, `--accent`. Bề rộng giữ nguyên khi khung thu phóng. */
const GEOMETRY_STROKE = 'var(--accent)';
const GEOMETRY_STROKE_WIDTH = 2;

/**
 * Nhãn trình đọc màn hình cho một dấu vùng lệch (A6: tiếng Việt, viết thường).
 *
 * Hợp đồng không mang chữ nào xuống cho từng dấu — `DeviationMarkViewModel` chỉ
 * có hình và cờ — nên số thứ tự là thứ duy nhất phân biệt được chúng bằng lời.
 * Đây là số đếm của danh sách, không phải một phép đo đi ra màn hình, nên A15
 * không đụng tới nó.
 */
const MARK_LABEL_PREFIX = 'vùng lệch ';
const MARK_LABEL_OVER_SUFFIX = ', vượt dung sai';

/* -------------------------------------------------------------------------- */
/* Khung chung của một lớp.                                                    */
/* -------------------------------------------------------------------------- */

export interface OverlayLayerFrameProps {
  readonly layer: OverlayLayerViewModel;
  /** Cắt theo đường chia đôi ở kiểu `swipe`; `undefined` ở hai kiểu còn lại. */
  readonly clipPath: string | undefined;
  /** Thuộc tính được hoà tan, và thời lượng của lượt hoà tan đó. */
  readonly transitionProperty: string;
  readonly transitionDuration: string;
}

interface LayerFrameProps extends OverlayLayerFrameProps {
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}

/**
 * Một mặt phẳng lớp, đặt chồng khít khung đối chiếu.
 *
 * `data-overlay-layer` là chỗ bài kiểm đếm lớp: đúng ba phần tử mang thuộc tính
 * này trong **mọi** kiểu đối chiếu, kể cả `sideBySide` nơi ba lớp nằm ở hai
 * khung khác nhau.
 *
 * Lớp bị tắt vẫn còn phần tử nhưng đi về `opacity: 0` và `aria-hidden` — nó
 * không được vẽ, và cũng không đọc lên cho trình đọc màn hình. Giữ phần tử lại
 * là điều kiện để lượt hoà tan có gì mà hoà: một lớp bị tháo khỏi cây DOM thì
 * biến mất trong một khung hình, không phải trong 340 ms.
 */
function LayerFrame({
  layer,
  clipPath,
  transitionProperty,
  transitionDuration,
  className,
  children,
}: LayerFrameProps) {
  const style: CSSProperties = {
    clipPath,
    opacity: layer.isVisible ? layer.opacity : 0,
    transitionDuration,
    transitionProperty,
  };

  return (
    <div
      aria-hidden={layer.isVisible ? undefined : true}
      aria-label={layer.label}
      className={cn('pointer-events-none absolute inset-0', className)}
      data-overlay-layer={layer.id}
      role="img"
      style={style}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp 1 — ảnh quét gốc, nét thuần.                                            */
/* -------------------------------------------------------------------------- */

/**
 * Bộ lọc ngưỡng. Xem phần "Vì sao ảnh quét đi qua một bộ lọc SVG" ở đầu file.
 *
 * Tấm `<svg>` rộng và cao 0 để không chiếm chỗ; nó ở đây chỉ để khai `<filter>`
 * cho lớp bên cạnh tham chiếu tới bằng `url(#…)`.
 */
export function ScanInkFilter({ id }: { readonly id: string }) {
  return (
    <svg aria-hidden="true" className="absolute" height={0} width={0}>
      <filter colorInterpolationFilters="sRGB" id={id}>
        <feColorMatrix
          result="darkness"
          type="matrix"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -0.33 -0.33 -0.33 0 1"
        />
        <feComponentTransfer in="darkness" result="ink">
          <feFuncA tableValues="0 0 1 1" type="discrete" />
        </feComponentTransfer>
        <feFlood floodColor="currentColor" result="tint" />
        <feComposite in="tint" in2="ink" operator="in" />
      </filter>
    </svg>
  );
}

export interface ScanLayerProps extends OverlayLayerFrameProps {
  readonly scanUrl: string | null;
  readonly filterId: string;
}

/**
 * Ảnh quét gốc sau khi cắt ngưỡng, tô bằng `--text-primary`.
 *
 * `scanUrl` là `null` ở tầng không có ảnh gốc — và đó là trạng thái *Trống* của
 * màn, không phải một lỗi. Mặt phẳng lớp vẫn còn, rỗng: bài kiểm vẫn đếm được
 * đúng ba lớp, và màn không vì thiếu ảnh mà mất một lớp.
 */
export function ScanLayer({ scanUrl, filterId, ...frame }: ScanLayerProps) {
  return (
    <LayerFrame className="text-text-primary" {...frame}>
      {scanUrl === null ? null : (
        <img
          alt=""
          className="block h-full w-full select-none object-contain"
          draggable={false}
          src={scanUrl}
          style={{ filter: `url(#${filterId})` }}
        />
      )}
    </LayerFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp 2 — hình học sinh ra.                                                   */
/* -------------------------------------------------------------------------- */

/** Một nét thành thuộc tính `d` của `<path>`, thẳng từ hệ tỉ lệ `0..1`. */
function pathOf(polyline: GeometryPolyline): string {
  const steps = polyline.points.map(
    (point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`,
  );

  return polyline.isClosed ? `${steps.join(' ')} Z` : steps.join(' ');
}

export interface GeometryLayerProps extends OverlayLayerFrameProps {
  readonly geometry: readonly GeometryPolyline[];
}

/**
 * Hình học mô hình, `--accent` ở độ mờ `layers.geometry.opacity` (0,6).
 *
 * Lớp này **có** dữ liệu ngay hôm nay, khác lớp `scan`: tường, phòng và ô mở đã
 * nằm trong store từ trước, và hook chiếu chúng xuống hệ tỉ lệ `0..1` trước khi
 * đưa xuống đây. Thứ còn thiếu (`imageToModelTransform`) là phép đặt **ảnh** vào
 * đúng chỗ, không phải phép dựng **mô hình** — hai lớp thiếu hai thứ khác nhau.
 *
 * `viewBox="0 0 1 1"` cộng `preserveAspectRatio="none"` cho phép đặt thẳng toạ độ
 * tỉ lệ vào `path` mà không phải nhân với kích thước đã render. Bề rộng nét thì
 * ngược lại — `vector-effect="non-scaling-stroke"` giữ nó ở 2px trên màn dù khung
 * đang phóng to bao nhiêu, cùng lý lẽ với `ScaleCalibrationCanvas`.
 */
export function GeometryLayer({ geometry, ...frame }: GeometryLayerProps) {
  return (
    <LayerFrame {...frame}>
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1 1"
      >
        {geometry.map((polyline) => (
          <path
            d={pathOf(polyline)}
            data-geometry-polyline={polyline.id}
            fill="none"
            key={polyline.id}
            stroke={GEOMETRY_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={GEOMETRY_STROKE_WIDTH}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </LayerFrame>
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp 3 — vùng lệch.                                                          */
/* -------------------------------------------------------------------------- */

export interface DeviationLayerProps extends OverlayLayerFrameProps {
  readonly marks: readonly DeviationMarkViewModel[];
  readonly isInteractive: boolean;
  /** Thời lượng một nhịp đập, đã lấy từ `MOTION_DURATIONS_MS` ở lớp cha. */
  readonly pulseDuration: string;
  readonly onSelectRegion: (id: string | null) => void;
}

/**
 * Gạch chéo cho vùng vượt dung sai, và một vùng bấm được cho mọi vùng.
 *
 * Ba quyết định đáng nói:
 *
 * - **Chỉ vùng vượt dung sai mới có gạch chéo.** Vùng trong dung sai vẫn bấm
 *   được — nó có hàng riêng trong panel và chọn được từ đó — nhưng nó không mang
 *   sơn nào cả. Cho nó một đường viền "trung tính" là thêm màu thứ tư.
 * - **`--accent` cho vùng đang chọn.** A2: màu nhấn dành cho thứ tương tác được.
 *   Vùng đang chọn là thứ khung vừa bay tới, nên nó mượn đúng token đó chứ không
 *   mượn `--state-attention`, thứ đã mang nghĩa "vượt dung sai".
 * - **Ba nhịp rồi giữ tĩnh.** `animate-pulse` là hoạt cảnh đã khai trong
 *   `tailwind.config.ts`; ở đây nó chỉ bị đổi nhịp — `animationDuration` xuống từ
 *   `MOTION_DURATIONS_MS`, `animationIterationCount` đếm đúng ba lần rồi thôi.
 *   `motion-reduce:animate-none` là chốt chặn thứ hai bên cạnh thời lượng 0 mà
 *   `durationMs` đã trả về, cùng khuôn `Skeleton.tsx`.
 */
export function DeviationLayer({
  marks,
  isInteractive,
  pulseDuration,
  onSelectRegion,
  ...frame
}: DeviationLayerProps) {
  return (
    <LayerFrame className={isInteractive ? 'pointer-events-auto' : undefined} {...frame}>
      {marks.map((mark, index) => (
        <button
          aria-label={`${MARK_LABEL_PREFIX}${index + 1}${
            mark.isOverTolerance ? MARK_LABEL_OVER_SUFFIX : ''
          }`}
          aria-pressed={mark.isSelected}
          className={cn(
            'absolute rounded-[4px] bg-transparent p-0',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            mark.isOverTolerance ? 'border border-state-attention' : 'border-0',
            mark.isSelected ? 'outline outline-2 outline-accent' : undefined,
            mark.hasJustCrossedTolerance ? 'animate-pulse motion-reduce:animate-none' : undefined,
          )}
          data-deviation-mark={mark.id}
          data-hatched={mark.isOverTolerance ? 'true' : 'false'}
          disabled={!isInteractive}
          key={mark.id}
          onClick={() => onSelectRegion(mark.id)}
          style={{
            animationDuration: mark.hasJustCrossedTolerance ? pulseDuration : undefined,
            animationIterationCount: mark.hasJustCrossedTolerance
              ? TOLERANCE_PULSE_BEATS
              : undefined,
            backgroundImage: mark.isOverTolerance ? HATCH_IMAGE : undefined,
            height: `${mark.box.height * PERCENT}%`,
            left: `${mark.box.x * PERCENT}%`,
            top: `${mark.box.y * PERCENT}%`,
            width: `${mark.box.width * PERCENT}%`,
          }}
          type="button"
        />
      ))}
    </LayerFrame>
  );
}
