/**
 * Biểu đồ phân bố độ dày đo được của màn QC "Chuẩn hoá độ dày tường".
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng {@link ThicknessHistogramProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`.
 * Không một quyết định nghiệp vụ nào ở đây — cột đã gộp sẵn theo bậc
 * `HISTOGRAM_BIN_MM` ở hook, nhãn ngưỡng đã định dạng sẵn (`thresholdLabels`,
 * A15), và việc sắp lại ba ngưỡng sau khi kéo cũng là của hook. File này chỉ
 * làm hai việc: chiếu mi-li-mét thành phần trăm bề ngang, và báo ra ngoài.
 *
 * ## Vì sao cột KHÔNG BAO GIỜ mang màu nhóm
 *
 * Cấm tuyệt đối của đặc tả S-18. Cột là số đếm, thứ trung tính; cái mang màu là
 * DẢI NỀN giữa hai ngưỡng, tô đúng xám tường của nhóm ở {@link BAND_OPACITY}.
 * Nhờ vậy người đọc thấy ánh xạ "đoạn mi-li-mét này rơi vào nhóm nào" mà không
 * bị nhầm rằng cột nào cao hơn thì "quan trọng hơn". Nên bảng màu của file này
 * chỉ có đúng: `--text-muted` (cột), `--bg-sunken` (nền vùng vẽ), `--accent`
 * (ba đường ngưỡng — A2: màu nhấn dành cho thứ tương tác được; nhãn chữ của
 * chúng không bấm được nên là `--text-secondary`, BUG-611), và ba xám tường
 * lấy qua `wallStrokeToken` cho dải nền.
 *
 * ## Vì sao ba đường ngưỡng là `role="slider"` chứ không phải chuyện của chuột
 *
 * A12 — bàn phím là đường đi hạng nhất, không phải phương án dự phòng. Một
 * đường kẻ 1px chỉ kéo được bằng chuột thì ba ngưỡng của màn này không tồn tại
 * với người dùng bàn phím. Mỗi đường vì thế là một thanh trượt thật: mũi tên
 * trái/phải bước đúng một bậc cột, Home/End nhảy về hai đầu trục, và
 * `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext` nói ra giá
 * trị hiện tại. Vùng bắt chuột rộng hơn nét vẽ (phần tử con trong suốt) vì 1px
 * là thứ không ai trỏ trúng.
 */

import { lowerFirst } from '@/lib/format/sentence';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

import { wallStrokeToken } from '@/components/canvas/materialMap';
import { motion } from '@/components/motion';
import { clampProgress, durationSeconds } from '@/lib/motion';

import {
  CONCRETE_COLUMN_GROUP,
  DEFAULT_THICKNESS_THRESHOLDS,
  HISTOGRAM_BIN_MM,
  HISTOGRAM_HEIGHT_PX,
  THICKNESS_GROUPS_MM,
  THICKNESS_GROUP_DISPLAY_ORDER,
  THICKNESS_GROUP_LABELS,
  type ThicknessGroup,
  type ThicknessHistogramProps,
} from './thicknessTypes';

/* -------------------------------------------------------------------------- */
/* Hằng bố cục — không phải hằng nghiệp vụ (R-71).                             */
/* -------------------------------------------------------------------------- */

/** Chuyển tỉ lệ 0..1 thành phần trăm CSS. */
const PERCENT = 100;

/** Độ mờ của dải xám tường — đúng con số tiền lệ `WallLayerList.tsx:168` dùng. */
const BAND_OPACITY = 0.08;

/** Cột không được trỏ tới mờ đi khi có một cột khác đang được trỏ. */
const DIMMED_BAR_OPACITY = 0.45;

/** Đệm hai đầu trục, tính bằng số bậc cột, để đường ngưỡng ngoài cùng vẫn nắm được. */
const AXIS_PADDING_BINS = 4;

/** Số vạch chữ tối đa trên trục x; nhiều hơn thì chữ chồng nhau. */
const AXIS_TICK_TARGET = 6;

/** Khoảng cách tối thiểu giữa hai nhãn trục x (nhãn 3 chữ số mono 11 px rộng ~20 px) — BUG-394. */
const AXIS_TICK_MIN_GAP_PX = 32;

/* -------------------------------------------------------------------------- */
/* Chuỗi tiếng Việt tĩnh — khớp `docs/notes/thickness/t6.i18n.fragment.json`.  */
/* -------------------------------------------------------------------------- */

const HISTOGRAM_LABEL = 'Biểu đồ phân bố độ dày tường theo mi-li-mét';
const LOADING_LABEL = 'Đang tải biểu đồ phân bố độ dày';
const AXIS_UNIT_LABEL = 'mm';

/**
 * Nhãn bàn phím của ba đường ngưỡng, ghép từ chính bảng nhãn nhóm.
 *
 * Ghép thay vì viết tay ba câu: ba ngưỡng LÀ ba ranh giới giữa bốn nhóm, nên
 * đổi nhãn một nhóm ở `thicknessTypes.ts` phải kéo theo nhãn ngưỡng, không để
 * hai chỗ trôi khỏi nhau.
 */
const THRESHOLD_LABELS: readonly string[] = THICKNESS_GROUPS_MM.map((group, index) => {
  const next: ThicknessGroup = THICKNESS_GROUP_DISPLAY_ORDER[index + 1] ?? CONCRETE_COLUMN_GROUP;

  return `Ngưỡng giữa ${lowerFirst(THICKNESS_GROUP_LABELS[group])} và ${lowerFirst(THICKNESS_GROUP_LABELS[next])}`;
});

/* -------------------------------------------------------------------------- */
/* Biểu đồ.                                                                    */
/* -------------------------------------------------------------------------- */

export function ThicknessHistogram({
  bins,
  thresholds,
  onThresholdDrag,
  thresholdLabels,
  hoveredBinIndex,
  onHoverBin,
  isLoading,
}: ThicknessHistogramProps) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  /**
   * Hai đầu trục x, mi-li-mét.
   *
   * Gộp khoảng của cột với ba ngưỡng MẶC ĐỊNH, không với ngưỡng đang kéo: trục
   * khoá theo ngưỡng đang kéo thì mỗi lần Home lại hạ đầu trục, và ngưỡng trôi
   * xuống không giới hạn (BUG-606). Trục cố định thì mọi ngưỡng bị kẹp trong nó,
   * nên vẫn luôn nhìn thấy và nắm lại được.
   */
  const { minMm, maxMm, spanMm } = useMemo(() => {
    const padding = HISTOGRAM_BIN_MM * AXIS_PADDING_BINS;
    const first = bins[0];
    const last = bins[bins.length - 1];
    const edges: number[] = [...DEFAULT_THICKNESS_THRESHOLDS];

    if (first !== undefined && last !== undefined) {
      edges.push(first.startMm, last.endMm);
    }

    const low = Math.min(...edges) - padding;
    const high = Math.max(...edges) + padding;

    return { minMm: low, maxMm: high, spanMm: Math.max(high - low, HISTOGRAM_BIN_MM) };
  }, [bins]);

  /** Một số đo mi-li-mét thành vị trí ngang, phần trăm bề rộng vùng vẽ. */
  const percentAt = useCallback(
    (value: number): number => clampProgress((value - minMm) / spanMm) * PERCENT,
    [minMm, spanMm],
  );

  /** Cột cao nhất, để quy mọi cột về tỉ lệ. Ít nhất 1 để không chia cho 0. */
  const tallestCount = useMemo(
    () => bins.reduce((tallest, bin) => Math.max(tallest, bin.count), 1),
    [bins],
  );

  /** Bốn dải nền, mỗi dải một nhóm, ranh giới là ba ngưỡng đang đặt. */
  const bands = useMemo(() => {
    const edges: readonly number[] = [minMm, ...thresholds, maxMm];

    return THICKNESS_GROUP_DISPLAY_ORDER.map((group, index) => {
      const fromMm = edges[index] ?? minMm;
      const toMm = edges[index + 1] ?? maxMm;
      const leftPercent = percentAt(fromMm);

      return {
        group,
        leftPercent,
        widthPercent: Math.max(percentAt(toMm) - leftPercent, 0),
      };
    });
  }, [maxMm, minMm, percentAt, thresholds]);

  /* Bề rộng vùng vẽ: nhãn trục x thưa theo PIXEL, không chỉ theo số cột (BUG-394). */
  const [plotWidthPx, setPlotWidthPx] = useState(0);

  useEffect(() => {
    const plot = plotRef.current;

    if (plot === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(() => setPlotWidthPx(plot.clientWidth));

    observer.observe(plot);

    return () => observer.disconnect();
    /* Lúc đang tải vùng vẽ chưa có trong cây: đo lại khi nó xuất hiện. */
  }, [isLoading]);

  /**
   * Vạch chữ trên trục x — thưa dần khi cột nhiều, tối đa {@link AXIS_TICK_TARGET}, và bỏ nhãn
   * nào đứng gần nhãn trước hơn {@link AXIS_TICK_MIN_GAP_PX}: năm cột 200–220 mm trên trục
   * 0–400 mm từng dính thành "200205210215220" ở 768.
   */
  const ticks = useMemo(() => {
    const stride = Math.max(1, Math.ceil(bins.length / AXIS_TICK_TARGET));
    const kept: { startMm: number; leftPercent: number }[] = [];

    for (const [index, bin] of bins.entries()) {
      const leftPercent = percentAt(bin.startMm);
      const last = kept[kept.length - 1];
      const isCrowded =
        last !== undefined &&
        ((leftPercent - last.leftPercent) * plotWidthPx) / PERCENT < AXIS_TICK_MIN_GAP_PX;

      if (index % stride === 0 && !isCrowded) {
        kept.push({ startMm: bin.startMm, leftPercent });
      }
    }

    return kept;
  }, [bins, percentAt, plotWidthPx]);

  /** Vị trí con trỏ thành mi-li-mét, bắt về đúng bậc cột gần nhất. */
  const millimetresAt = useCallback(
    (clientX: number): number | null => {
      const plot = plotRef.current;

      if (plot === null) {
        return null;
      }

      const box = plot.getBoundingClientRect();

      if (box.width <= 0) {
        return null;
      }

      const ratio = clampProgress((clientX - box.left) / box.width);

      return Math.round((minMm + ratio * spanMm) / HISTOGRAM_BIN_MM) * HISTOGRAM_BIN_MM;
    },
    [minMm, spanMm],
  );

  const handlePointerDown = useCallback(
    (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraggingIndex(index);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
      if (draggingIndex !== index) {
        return;
      }

      const value = millimetresAt(event.clientX);

      if (value !== null) {
        onThresholdDrag(index, value);
      }
    },
    [draggingIndex, millimetresAt, onThresholdDrag],
  );

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setDraggingIndex(null);
  }, []);

  /** Bàn phím: mũi tên bước một bậc cột, Home/End về hai đầu trục (A12). */
  const handleKeyDown = useCallback(
    (index: number, value: number) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const next = ((): number | null => {
        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowDown':
            return value - HISTOGRAM_BIN_MM;
          case 'ArrowRight':
          case 'ArrowUp':
            return value + HISTOGRAM_BIN_MM;
          case 'Home':
            return minMm;
          case 'End':
            return maxMm;
          default:
            return null;
        }
      })();

      if (next === null) {
        return;
      }

      event.preventDefault();
      onThresholdDrag(index, Math.min(Math.max(next, minMm), maxMm));
    },
    [maxMm, minMm, onThresholdDrag],
  );

  const handlePlotLeave = useCallback(() => {
    onHoverBin(null);
  }, [onHoverBin]);

  if (isLoading) {
    return (
      <section aria-busy="true" aria-label={LOADING_LABEL} className="flex w-full flex-col gap-2">
        <div className="h-4 w-full" />
        <div
          className="w-full animate-pulse bg-border-default motion-reduce:animate-none"
          style={{ height: HISTOGRAM_HEIGHT_PX }}
        />
        <div className="h-4 w-full" />
      </section>
    );
  }

  return (
    <section aria-label={HISTOGRAM_LABEL} className="flex w-full flex-col gap-2">
      {/* Nhãn ba ngưỡng, chữ đều, nằm trên vùng vẽ để không bị cắt ở hai mép. */}
      <div className="relative h-4 w-full">
        {thresholds.map((value, index) => (
          <motion.span
            key={String(index)}
            className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] leading-4 tabular-nums text-text-secondary"
            initial={false}
            animate={{ left: `${String(percentAt(value))}%` }}
            transition={{ duration: durationSeconds('standard') }}
          >
            {thresholdLabels[index] ?? ''}
          </motion.span>
        ))}
      </div>

      {/* Vùng vẽ — chiều cao đúng HISTOGRAM_HEIGHT_PX ở mọi trạng thái. */}
      <div
        ref={plotRef}
        className="relative w-full overflow-hidden bg-bg-sunken"
        style={{ height: HISTOGRAM_HEIGHT_PX }}
        onPointerLeave={handlePlotLeave}
      >
        {/* Dải nhóm: thứ DUY NHẤT mang màu xám tường, ở độ mờ thấp. */}
        {bands.map((band) => (
          <motion.div
            key={String(band.group)}
            aria-hidden="true"
            className="absolute inset-y-0"
            style={{ backgroundColor: wallStrokeToken(band.group), opacity: BAND_OPACITY }}
            initial={false}
            animate={{
              left: `${String(band.leftPercent)}%`,
              width: `${String(band.widthPercent)}%`,
            }}
            transition={{ duration: durationSeconds('standard') }}
          />
        ))}

        {/* Cột: trung tính, luôn `--text-muted`. Vùng bắt chuột cao hết khung. */}
        {bins.map((bin, index) => {
          const leftPercent = percentAt(bin.startMm);
          const isDimmed = hoveredBinIndex !== null && hoveredBinIndex !== index;

          return (
            <div
              key={`${String(bin.startMm)}-${String(bin.endMm)}`}
              className="absolute inset-y-0 flex items-end"
              style={{
                left: `${String(leftPercent)}%`,
                width: `${String(Math.max(percentAt(bin.endMm) - leftPercent, 0))}%`,
              }}
              onPointerEnter={() => {
                onHoverBin(index);
              }}
            >
              <div
                aria-hidden="true"
                className="w-full bg-text-muted transition-opacity duration-standard"
                style={{
                  height: `${String((bin.count / tallestCount) * PERCENT)}%`,
                  opacity: isDimmed ? DIMMED_BAR_OPACITY : 1,
                }}
              />
            </div>
          );
        })}

        {/* Ba đường ngưỡng kéo được — bằng chuột và bằng bàn phím. */}
        {thresholds.map((value, index) => (
          <motion.div
            key={String(index)}
            role="slider"
            tabIndex={0}
            aria-label={THRESHOLD_LABELS[index] ?? ''}
            aria-orientation="horizontal"
            aria-valuemax={maxMm}
            aria-valuemin={minMm}
            aria-valuenow={value}
            aria-valuetext={thresholdLabels[index] ?? ''}
            className="absolute inset-y-0 w-px cursor-ew-resize touch-none bg-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            initial={false}
            animate={{ left: `${String(percentAt(value))}%` }}
            transition={{ duration: durationSeconds('standard') }}
            onKeyDown={handleKeyDown(index, value)}
            onPointerDown={handlePointerDown(index)}
            onPointerMove={handlePointerMove(index)}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* Vùng nắm 24 px quanh nét vẽ — 1px là thứ không ai trỏ trúng (BUG-325). */}
            <span aria-hidden="true" className="absolute inset-y-0 -left-3 w-6" />
          </motion.div>
        ))}
      </div>

      {/* Trục x, chữ đều, đơn vị mi-li-mét. */}
      <div className="relative h-4 w-full">
        {ticks.map((tick) => (
          <span
            key={String(tick.startMm)}
            className="absolute top-0 -translate-x-1/2 font-mono text-[11px] leading-4 tabular-nums text-text-muted"
            style={{ left: `${String(tick.leftPercent)}%` }}
          >
            {tick.startMm}
          </span>
        ))}
        <span className="absolute right-0 top-0 font-mono text-[11px] leading-4 text-text-muted">
          {AXIS_UNIT_LABEL}
        </span>
      </div>
    </section>
  );
}
