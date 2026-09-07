/**
 * Lớp phủ số đo — đường đo, đường gióng và nhãn, vẽ đè lên canvas 3D.
 *
 * View thuần R-60: không nhập `@/api`, `@/store`, `@/domain`, `@/lib/http`. Mọi
 * chuỗi số tới đây đã định dạng xong (A15); file này không tính một số đo nào,
 * không quy đổi một đơn vị nào, và không ghi gì trở lại mô hình.
 *
 * ## Vì sao lớp phủ nhận `screenPoints` chứ không nhận `points`
 *
 * Phép đo sống trong không gian thế giới (milimet, ba trục), còn lớp phủ vẽ
 * bằng pixel khung nhìn. Phép chiếu world → NDC → pixel cần camera, và camera
 * là thứ view thuần không được biết — nên hook chiếu mỗi khung hình rồi đưa
 * xuống kết quả đã chiếu, còn file này chỉ nối các điểm lại. `screenPoints` là
 * `null` khi phép đo nằm ngoài khung nhìn, và khi đó không có gì để vẽ.
 *
 * ## Nhãn LUÔN ĐỨNG THẲNG HƯỚNG NGƯỜI XEM
 *
 * Đây là lời hứa dễ vỡ nhất của một lớp phủ 3D, nên nó được giữ bằng cấu trúc
 * chứ không bằng một phép tính đối trọng: nhãn là `<div>` HTML định vị tuyệt
 * đối trong mặt phẳng màn hình, và **không có một phép xoay nào được áp lên
 * chúng ở bất kỳ đâu trong file này**. Camera quay đủ 360 độ thì các điểm neo
 * chạy quanh màn, còn viên thuốc chữ vẫn nằm phẳng đúng như lúc đầu — không có
 * đường nào cho nó lộn ngược. Chỉ `transform` duy nhất trên nhãn là
 * `translate(-50%, -50%)` để tâm nhãn trùng điểm neo.
 *
 * ## Chuyển động — ba chỗ, cả ba lấy từ thang của mục B (R-71)
 *
 * 1. **Đường gióng vẽ ra khi ghim** — `standard` (260 ms). Đặc tả gốc ghi
 *    240 ms; 240 không tồn tại trong `MOTION_DURATIONS_MS` nên hợp đồng chốt
 *    `standard`. Vạch gióng nở ra từ chính đầu mút nhờ `transform-origin` đặt
 *    tại điểm đó, nên nó trông như được vạch ra chứ không như được bật lên.
 * 2. **Nhãn lắng vào trung điểm** — cùng `standard`, cùng nhịp gắn kết với (1):
 *    nhãn đang bám con trỏ là nhãn của bản nháp, nhãn ở trung điểm là nhãn của
 *    phép đo đã ghim, và nhãn thứ hai trồi vào chỗ của nó khi bản nháp biến mất.
 * 3. **Đổi đơn vị, nhãn chạy số** — `standard`, và đây là **chỗ DUY NHẤT của cả
 *    màn được chạy số**. Xem {@link PinnedLabel}.
 *
 * Làm mờ khi trỏ vào một hàng khác đi ở nhịp `instant`: đó là trạng thái con
 * trỏ đang đứng lên, và thang của mục B xếp việc đó vào `instant`.
 *
 * ## Màu
 *
 * Đường đo, đĩa đầu mút và đường gióng đều dùng `--accent` (A1: không mã màu
 * thô). Chấm "cần chú ý" của một phép đo hết neo (`stale`) cũng dùng `--accent`
 * — **không đỏ, không vàng**, vì đặc tả cấm hai màu đó ở lớp phủ này, và
 * `--state-verified` thì A5 dành riêng cho việc người duyệt nên nó cũng không
 * dùng được. Còn lại đúng một màu hợp lệ, và nó không thêm màu thứ tư nào vào
 * bộ ba của A4.
 */
import { useEffect, useRef, useState } from 'react';

import { useCountUp } from '@/hooks/useCountUp';
import { cn } from '@/lib/utils';

import type {
  DraftMeasurement,
  PinnedMeasurement,
  PinnedMeasurementId,
  ScreenPoint,
} from './measurementToolTypes';

/* -------------------------------------------------------------------------- */
/* Hằng hình học, tính bằng pixel khung nhìn.                                   */
/* -------------------------------------------------------------------------- */

/** Bề rộng nét đường đo. */
const MEASURE_STROKE_PX = 2;

/** Bề rộng nét đường gióng. */
const EXTENSION_STROKE_PX = 1;

/** Đường kính đĩa đầu mút. */
const ENDPOINT_DIAMETER_PX = 8;

const ENDPOINT_RADIUS_PX = ENDPOINT_DIAMETER_PX / 2;

/** Nửa chiều dài một vạch gióng, đo từ đầu mút ra mỗi bên. */
const EXTENSION_HALF_LENGTH_PX = 9;

/** Nét đứt của đường gióng: vạch, rồi khoảng trống. */
const EXTENSION_DASH = '4 3';

/** Độ mờ của đường gióng — nửa đậm so với đường đo. */
const EXTENSION_OPACITY = 0.5;

/** Độ mờ của một phép đo không được trỏ tới, khi có phép đo khác đang được trỏ. */
const DIMMED_OPACITY = 0.3;

/* -------------------------------------------------------------------------- */
/* Hình học của lớp phủ — toàn bộ là bố cục pixel, không phép đo nào ở đây.     */
/* -------------------------------------------------------------------------- */

/** Chuỗi `points` của `<polyline>`. */
function polylineOf(points: readonly ScreenPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(' ');
}

/** Trung điểm giữa đầu và cuối chuỗi điểm — chỗ nhãn lắng vào. */
function midpointOf(points: readonly ScreenPoint[]): ScreenPoint | null {
  const first = points[0];
  const last = points[points.length - 1];

  if (first === undefined || last === undefined) {
    return null;
  }

  return { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
}

/**
 * Hướng vuông góc với đoạn đo, đã chuẩn hoá — hướng của vạch gióng.
 *
 * Đoạn suy biến (hai đầu mút trùng nhau) không có hướng nào, và trả về vector
 * thẳng đứng là cách duy nhất vẫn vẽ ra được một vạch đọc hiểu được thay vì
 * không vẽ gì.
 */
function perpendicularOf(from: ScreenPoint, to: ScreenPoint): ScreenPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const span = Math.hypot(dx, dy);

  if (span === 0) {
    return { x: 0, y: -1 };
  }

  return { x: -dy / span, y: dx / span };
}

/**
 * `false` ở khung hình đầu, `true` từ khung hình sau — cái chốt để một phần tử
 * vừa gắn tự chuyển từ trạng thái đầu sang trạng thái nghỉ của nó.
 */
function useHasSettled(): boolean {
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    setSettled(true);
  }, []);

  return settled;
}

/* -------------------------------------------------------------------------- */
/* Đường gióng.                                                                */
/* -------------------------------------------------------------------------- */

interface ExtensionTicksProps {
  readonly points: readonly ScreenPoint[];
}

/**
 * Vạch gióng ở hai đầu mút, vẽ ra khi phép đo vừa được ghim.
 *
 * `transform-origin` đặt đúng tại đầu mút nên vạch nở ra từ điểm đó về cả hai
 * phía, giống một cây thước được đặt xuống chứ không phải một nét được bật lên.
 */
function ExtensionTicks({ points }: ExtensionTicksProps) {
  const settled = useHasSettled();

  const first = points[0];
  const last = points[points.length - 1];

  if (first === undefined || last === undefined) {
    return null;
  }

  const axis = perpendicularOf(first, last);
  const ends = first === last ? [first] : [first, last];

  return (
    <g opacity={EXTENSION_OPACITY}>
      {ends.map((end, index) => (
        <g
          className="transition-transform duration-standard ease-enter motion-reduce:transition-none"
          key={index}
          style={{
            transform: settled ? 'scale(1)' : 'scale(0)',
            transformOrigin: `${end.x}px ${end.y}px`,
          }}
        >
          <line
            className="stroke-accent"
            strokeDasharray={EXTENSION_DASH}
            strokeWidth={EXTENSION_STROKE_PX}
            x1={end.x - axis.x * EXTENSION_HALF_LENGTH_PX}
            x2={end.x + axis.x * EXTENSION_HALF_LENGTH_PX}
            y1={end.y - axis.y * EXTENSION_HALF_LENGTH_PX}
            y2={end.y + axis.y * EXTENSION_HALF_LENGTH_PX}
          />
        </g>
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Hình của một phép đo.                                                       */
/* -------------------------------------------------------------------------- */

interface MeasurementShapeProps {
  readonly points: readonly ScreenPoint[];
  readonly dimmed: boolean;
  readonly withExtensions: boolean;
}

/** Đường đo cộng đĩa đầu mút, và đường gióng khi phép đo đã ghim. */
function MeasurementShape({ points, dimmed, withExtensions }: MeasurementShapeProps) {
  return (
    <g
      className="transition-opacity duration-instant motion-reduce:transition-none"
      opacity={dimmed ? DIMMED_OPACITY : 1}
    >
      {withExtensions && <ExtensionTicks points={points} />}

      <polyline
        className="fill-none stroke-accent"
        points={polylineOf(points)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={MEASURE_STROKE_PX}
      />

      {points.map((point, index) => (
        <circle
          className="fill-accent"
          cx={point.x}
          cy={point.y}
          key={index}
          r={ENDPOINT_RADIUS_PX}
        />
      ))}
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* Nhãn.                                                                       */
/* -------------------------------------------------------------------------- */

interface ValuePillProps {
  readonly at: ScreenPoint;
  readonly text: string;
  readonly dimmed: boolean;
  readonly settling: boolean;
  readonly stale: boolean;
  readonly staleReason: string | null;
}

/**
 * Viên thuốc trắng mang một số đo.
 *
 * Nền hơi mờ để chữ đọc được trên cả mảng tường sáng lẫn nền tối của cảnh, và
 * chữ đều (`font-mono`) cộng `tabular-nums` để bề rộng con số không nhúc nhích
 * khi giá trị đổi — thứ đọc như một cây thước rung nếu để chữ tỉ lệ.
 *
 * Hai lớp `<div>` vì có hai chuyển động khác nhịp nhau, và chồng chúng lên một
 * phần tử thì một cái sẽ phải mượn nhịp của cái kia: lớp ngoài là nhãn **lắng
 * vào chỗ** lúc vừa ghim (`standard`), lớp trong là nhãn **mờ đi** khi con trỏ
 * đang đứng trên một hàng khác (`instant`, đúng ô của thang mục B cho trạng
 * thái con trỏ).
 */
function ValuePill({ at, text, dimmed, settling, stale, staleReason }: ValuePillProps) {
  const settled = useHasSettled();

  return (
    <div
      className={cn(
        'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2',
        settling && 'transition-opacity duration-standard ease-enter motion-reduce:transition-none',
      )}
      style={{ left: at.x, top: at.y, opacity: settling && !settled ? 0 : 1 }}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/90 px-2.5 py-1 shadow-float',
          'font-mono text-[13px] leading-none tabular-nums text-black',
          'transition-opacity duration-instant motion-reduce:transition-none',
        )}
        style={{ opacity: dimmed ? DIMMED_OPACITY : 1 }}
      >
        {stale && (
          <span aria-hidden="true" className="block h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        )}
        <span>{text}</span>
        {stale && staleReason !== null && <span className="sr-only">{staleReason}</span>}
      </div>
    </div>
  );
}

interface PinnedLabelProps {
  readonly measurement: PinnedMeasurement;
  readonly at: ScreenPoint;
  readonly dimmed: boolean;
  readonly unitJustChanged: boolean;
}

/**
 * Nhãn của một phép đo đã ghim — chỗ DUY NHẤT của màn được chạy số.
 *
 * `valueLabel` là chuỗi đã định dạng, và giữa `"3.450 mm"` và `"3,45 m"` không
 * có gì để nội suy; nên hợp đồng đưa xuống thêm `displayValue` (cùng giá trị
 * ấy, đã sang đơn vị đang chọn, nhưng vẫn là SỐ), `displayFractionDigits` và
 * `unitSuffix`. View không quy đổi và không tự chọn số chữ số thập phân — hook
 * đã quyết cả hai bằng `src/lib/format` (A15 nguyên vẹn).
 *
 * Engine chạy số là `useCountUp` có sẵn của repo, không phải một vòng lặp đếm
 * mới, và nó chạy đúng ở nhịp `standard` (`COUNT_UP_DURATION`).
 *
 * **Lúc gắn thì không chạy số.** `from` cố định ở giá trị đầu tiên nên lượt
 * chạy đầu có `from === to`, mà `sampleCountUp` coi một lượt không có quãng
 * đường là lượt đã xong ngay — `done` là `true` từ khung hình đầu, và nhãn in
 * `valueLabel` tĩnh. Chỉ khi `displayValue` đổi (tức là người dùng vừa đổi đơn
 * vị) `done` mới thành `false` và chữ chuyển sang bản đang chạy, rồi tự trả về
 * `valueLabel` khi lượt chạy kết thúc.
 */
function PinnedLabel({ measurement, at, dimmed, unitJustChanged }: PinnedLabelProps) {
  const settledValueRef = useRef(measurement.displayValue);
  const [counting, setCounting] = useState(false);

  const countUp = useCountUp(measurement.displayValue, {
    from: settledValueRef.current,
    format: { fractionDigits: measurement.displayFractionDigits },
  });

  /*
   * Một chốt, và nó là chỗ cả điều cấm của màn nằm gọn trong một dòng.
   *
   * `useCountUp` bắt đầu chạy mỗi lần đích đổi, bất kể vì sao đích đổi. Nhưng
   * đặc tả cho phép chạy số ĐÚNG MỘT LÝ DO: người dùng vừa đổi đơn vị. Một
   * phép đo được tính lại, một hàng được thay giá trị, một lượt tải về — tất cả
   * đều làm `displayValue` đổi, và không cái nào được phép làm chữ nhảy số.
   *
   * `unitJustChanged` chỉ bật một nhịp, nên đọc thẳng nó thì lượt chạy tắt ngay
   * ở khung hình sau. Chốt này giữ "đang chạy vì đổi đơn vị" cho tới khi lượt
   * chạy kết thúc, rồi tự mở ra.
   */
  useEffect(() => {
    if (unitJustChanged) {
      setCounting(true);
    }
  }, [unitJustChanged]);

  useEffect(() => {
    if (countUp.done) {
      setCounting(false);
      settledValueRef.current = measurement.displayValue;
    }
  }, [countUp.done, measurement.displayValue]);

  const isRunningUp = counting && !countUp.done;

  return (
    <ValuePill
      at={at}
      dimmed={dimmed}
      settling
      stale={measurement.stale}
      staleReason={measurement.staleReason}
      text={isRunningUp ? `${countUp.text} ${measurement.unitSuffix}` : measurement.valueLabel}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp phủ.                                                                    */
/* -------------------------------------------------------------------------- */

export interface MeasurementOverlayProps {
  readonly measurements: readonly PinnedMeasurement[];
  readonly draft: DraftMeasurement | null;
  readonly highlightedId: PinnedMeasurementId | null;
  readonly unitJustChanged: boolean;
}

export function MeasurementOverlay({
  measurements,
  draft,
  highlightedId,
  unitJustChanged,
}: MeasurementOverlayProps) {
  const drawn = measurements.filter(
    (measurement) => measurement.visible && measurement.screenPoints !== null,
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full">
        {drawn.map((measurement) => (
          <MeasurementShape
            dimmed={highlightedId !== null && highlightedId !== measurement.id}
            key={measurement.id}
            points={measurement.screenPoints ?? []}
            withExtensions
          />
        ))}

        {draft !== null && draft.screenPoints.length > 0 && (
          <MeasurementShape dimmed={false} points={draft.screenPoints} withExtensions={false} />
        )}
      </svg>

      {drawn.map((measurement) => {
        const at = midpointOf(measurement.screenPoints ?? []);

        if (at === null) {
          return null;
        }

        return (
          <PinnedLabel
            at={at}
            dimmed={highlightedId !== null && highlightedId !== measurement.id}
            key={measurement.id}
            measurement={measurement}
            unitJustChanged={unitJustChanged}
          />
        );
      })}

      {draft !== null && draft.cursorPx !== null && draft.valueLabel !== null && (
        <ValuePill
          at={draft.cursorPx}
          dimmed={false}
          settling={false}
          stale={false}
          staleReason={null}
          text={draft.valueLabel}
        />
      )}
    </div>
  );
}
