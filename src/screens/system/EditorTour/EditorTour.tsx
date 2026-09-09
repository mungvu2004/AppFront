/**
 * Lớp dạy việc chạy đè lên trình soạn thảo — nửa vẽ của mục D.
 *
 * View thuần: mọi thứ nó biết nằm trong {@link EditorTourProps}. Không store,
 * không mạng, không `@/domain` — `local/no-data-layer-in-view` (R-60) giữ điều
 * đó, và nhờ vậy sáu bước dựng lại được trong test chỉ bằng một object.
 *
 * Ba quyết định đáng nói, vì cả ba trông như tự làm khó mình:
 *
 * - **Nền tối là bốn tấm quanh lỗ, không phải một tấm có mặt nạ.** Lớp này
 *   không được chặn người dùng làm việc: thứ đang được dạy phải bấm được ngay
 *   trong lúc thẻ nhắc nói về nó. Bốn tấm để lại một ô trống thật sự — không
 *   phần tử nào phủ lên vùng khoét, nên không cần mẹo `pointer-events` nào cả.
 *   Bấm vào tấm tối là bỏ qua.
 * - **Đây không phải hộp thoại.** Không `role="dialog"`, không `aria-modal`,
 *   không bẫy tiêu điểm — Tab phải đi được từ thẻ ra đúng thứ đang tô sáng.
 *   Thẻ là một `<section>` mang tên từ tiêu đề của chính bước.
 * - **Độ mờ của nền viết nội tuyến.** Hậu tố alpha của Tailwind (`bg-x/28`) và
 *   `bg-opacity-N` biên dịch ra rỗng ở repo này vì biến màu là `var()` trần.
 *   Màu vẫn lấy từ token (A1); chỉ độ trong suốt là `opacity` nội tuyến.
 *
 * Bộ đếm lấy mẫu số từ `steps.length`, không phải hằng sáu: bước mất cả phím
 * lẫn neo đã bị hook bỏ khỏi mảng, và bộ đếm phải rút theo.
 */

import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { cssDurationMs, MOTION_EASINGS } from '@/lib/motion/tokens';

import type { EditorTourProps, TourPlacement, TourRect } from './useEditorTour';

/* -------------------------------------------------------------------------- */
/* Hình học. Không con số nào ở đây là thời lượng — xem mục chuyển động dưới.  */
/* -------------------------------------------------------------------------- */

/** Bề ngang thẻ nhắc. */
const CARD_WIDTH = 320;
/** Cạnh mũi nhọn, trước khi xoay 45°. */
const ARROW = 8;
/** Khe giữa mép neo và mép thẻ. */
const GAP = 12;
/** Lề tối thiểu giữa thẻ và mép khung nhìn. */
const MARGIN = 16;
/** Mũi nhọn không bò sát góc bo của thẻ. */
const ARROW_INSET = 20;
/** Quãng trượt của thẻ lúc sang bước. */
const SLIDE = 8;
/** Nền đậm nhất 28% — tối hơn nữa là che mất thứ đang dạy. */
const BACKDROP_OPACITY = 0.28;
/** Nửa mũi nhọn thò ra khỏi mép thẻ. */
const ARROW_OUT = -ARROW / 2;

/** Hai cạnh của hình vuông xoay 45° quay về phía neo. */
const ARROW_EDGES: Readonly<Record<TourPlacement, string>> = {
  top: 'border-b border-r',
  bottom: 'border-l border-t',
  left: 'border-r border-t',
  right: 'border-b border-l',
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Mép trên-trái của thẻ, theo neo và hướng đứng, đã kẹp trong khung nhìn. */
function cardOrigin(
  rect: TourRect,
  placement: TourPlacement,
  cardHeight: number,
  viewWidth: number,
  viewHeight: number,
): { readonly left: number; readonly top: number } {
  const centreX = rect.left + rect.width / 2 - CARD_WIDTH / 2;
  const centreY = rect.top + rect.height / 2 - cardHeight / 2;

  const raw =
    placement === 'top'
      ? { left: centreX, top: rect.top - cardHeight - GAP }
      : placement === 'bottom'
        ? { left: centreX, top: rect.top + rect.height + GAP }
        : placement === 'left'
          ? { left: rect.left - CARD_WIDTH - GAP, top: centreY }
          : { left: rect.left + rect.width + GAP, top: centreY };

  return {
    left: clamp(raw.left, MARGIN, Math.max(MARGIN, viewWidth - CARD_WIDTH - MARGIN)),
    top: clamp(raw.top, MARGIN, Math.max(MARGIN, viewHeight - cardHeight - MARGIN)),
  };
}

/**
 * Bốn tấm quanh ô được dạy.
 *
 * Không tấm nào phủ lên ô, nên phần tử bên trong vẫn nhận được con trỏ — đó là
 * cả lý do lớp này khoét bằng bốn hình chữ nhật thay vì một mặt nạ.
 */
function backdropPanels(
  hole: TourRect,
): readonly { readonly side: string; readonly box: CSSProperties }[] {
  return [
    { side: 'top', box: { top: 0, left: 0, right: 0, height: Math.max(0, hole.top) } },
    { side: 'bottom', box: { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 } },
    {
      side: 'left',
      box: { top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height },
    },
    {
      side: 'right',
      box: { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height },
    },
  ];
}

export function EditorTour(props: EditorTourProps) {
  const {
    screenState,
    steps,
    activeIndex,
    cutout,
    isCollapsed,
    isReducedMotion,
    summary,
    isSkipChipVisible,
    liveMessage,
    onNext,
    onSkip,
    onJump,
    onFinish,
    onReopen,
    onOpenSampleProject,
  } = props;

  const titleId = useId();
  const cardRef = useRef<HTMLElement | null>(null);

  /* Đo lại chiều cao thẻ: trạng thái thuần trình bày, không phải dữ liệu máy
     chủ. Thẻ đứng trên neo thì phải biết mình cao bao nhiêu mới đặt được mép. */
  const [cardHeight, setCardHeight] = useState(0);

  /* Hướng đi giữa hai bước, và một nhịp "vừa vào" để CSS có cái để chạy tới. */
  const previousIndexRef = useRef(activeIndex);
  const [entering, setEntering] = useState<-1 | 0 | 1>(0);

  const step = activeIndex >= 0 ? (steps[activeIndex] ?? null) : null;

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (node !== null) {
      setCardHeight(node.getBoundingClientRect().height);
    }
  }, [step, screenState, isCollapsed, summary]);

  useLayoutEffect(() => {
    const previous = previousIndexRef.current;
    if (previous === activeIndex) {
      return undefined;
    }
    previousIndexRef.current = activeIndex;
    setEntering(activeIndex >= previous ? 1 : -1);
    const handle = requestAnimationFrame(() => {
      setEntering(0);
    });
    return () => {
      cancelAnimationFrame(handle);
    };
  }, [activeIndex]);

  const isInvite = screenState === 'loading';
  const isSummary = screenState === 'success';
  const isBlank = screenState === 'empty';
  const showsCard = !isBlank && (isInvite || isSummary || step !== null);
  const showsCutout = !isBlank && !isCollapsed && !isInvite && !isSummary && cutout !== null;
  const showsDots = showsCard && !isInvite && !isSummary && steps.length > 0;

  /* --- Chuyển động: ba con số, cả ba đọc từ bảng của src/lib/motion. ------ */

  const slide = isReducedMotion ? 0 : entering * SLIDE;
  const cardStyle: CSSProperties = {
    opacity: entering === 0 ? 1 : 0,
    transform: `translateX(${slide}px)`,
    transitionProperty: isReducedMotion ? 'opacity' : 'opacity, transform',
    transitionDuration: cssDurationMs(isReducedMotion ? 'instant' : 'standard'),
    transitionTimingFunction: MOTION_EASINGS.enter.css,
  };

  /* Giảm chuyển động: `cssDurationMs` trả 0ms, nên vùng khoét nhảy thẳng tới
     chỗ mới thay vì chạy — đúng nghĩa "đứng yên". */
  const cutoutMotion: CSSProperties = {
    transitionProperty: 'top, left, width, height',
    transitionDuration: cssDurationMs('slow', { reducedMotion: isReducedMotion }),
    transitionTimingFunction: MOTION_EASINGS.inOut.css,
  };

  /* --- Chỗ đứng của thẻ. -------------------------------------------------- */

  const viewWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewHeight = typeof window === 'undefined' ? 0 : window.innerHeight;
  const anchor = isCollapsed || isInvite || isSummary ? null : (step?.anchorRect ?? null);
  const placement: TourPlacement = step?.placement ?? 'bottom';
  const origin =
    anchor === null ? null : cardOrigin(anchor, placement, cardHeight, viewWidth, viewHeight);

  const framePosition: CSSProperties = isCollapsed
    ? { left: 0, right: 0, bottom: 0 }
    : origin === null
      ? { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
      : { left: origin.left, top: origin.top };

  const arrowStyle: CSSProperties =
    anchor === null || origin === null
      ? {}
      : placement === 'top' || placement === 'bottom'
        ? {
            left: clamp(
              anchor.left + anchor.width / 2 - origin.left - ARROW / 2,
              ARROW_INSET,
              CARD_WIDTH - ARROW_INSET,
            ),
            ...(placement === 'top' ? { bottom: ARROW_OUT } : { top: ARROW_OUT }),
          }
        : {
            top: clamp(
              anchor.top + anchor.height / 2 - origin.top - ARROW / 2,
              ARROW_INSET,
              Math.max(ARROW_INSET, cardHeight - ARROW_INSET),
            ),
            ...(placement === 'left' ? { right: ARROW_OUT } : { left: ARROW_OUT }),
          };

  const cardShape = isCollapsed
    ? 'w-full rounded-t-[12px] border-t'
    : 'w-[320px] rounded-[12px] border';

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {showsCutout && cutout !== null && (
        <>
          {backdropPanels(cutout).map((panel) => (
            <div
              key={panel.side}
              aria-hidden="true"
              className="pointer-events-auto fixed bg-bg-overlay"
              style={{ ...panel.box, ...cutoutMotion, opacity: BACKDROP_OPACITY }}
              onClick={onSkip}
            />
          ))}
          <div
            aria-hidden="true"
            className="pointer-events-none fixed rounded-[6px] border-2 border-accent"
            style={{
              top: cutout.top,
              left: cutout.left,
              width: cutout.width,
              height: cutout.height,
              ...cutoutMotion,
            }}
          />
        </>
      )}

      {showsCard && (
        <div className="fixed" style={framePosition}>
          <section
            ref={cardRef}
            aria-labelledby={titleId}
            className={`pointer-events-auto relative border-border-default bg-bg-surface p-[20px] shadow-float ${cardShape}`}
            style={cardStyle}
          >
            {anchor !== null && !isCollapsed && (
              <span
                aria-hidden="true"
                className={`absolute h-[8px] w-[8px] rotate-45 border-border-default bg-bg-surface ${ARROW_EDGES[placement]}`}
                style={arrowStyle}
              />
            )}

            {isInvite ? (
              <>
                <h3 id={titleId} className="text-[15px] font-medium text-text-primary">
                  chưa có gì trên khung vẽ
                </h3>
                <p className="mt-[8px] text-[13px] leading-relaxed text-text-secondary">
                  lớp chỉ dẫn cần một mặt bằng đang mở thì mới trỏ vào đâu được. mở bộ mẫu
                  rồi quay lại đây.
                </p>
                <div className="mt-[20px] flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={onSkip}>
                    bỏ qua
                  </Button>
                  <Button variant="primary" size="sm" onClick={onOpenSampleProject}>
                    mở bộ mẫu
                  </Button>
                </div>
              </>
            ) : isSummary ? (
              <>
                <h3 id={titleId} className="text-[15px] font-medium text-text-primary">
                  bấy nhiêu phím là đủ dùng
                </h3>
                <ul className="mt-[12px] flex flex-col gap-[8px]">
                  {summary.map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-[12px]">
                      <span className="text-[13px] text-text-secondary">{row.label}</span>
                      <Kbd>{row.combo}</Kbd>
                    </li>
                  ))}
                </ul>
                <div className="mt-[20px] flex justify-end">
                  <Button variant="primary" size="sm" onClick={onFinish}>
                    bắt đầu làm việc
                  </Button>
                </div>
              </>
            ) : (
              step !== null && (
                <>
                  <p className="font-mono text-[13px] text-text-muted">
                    {activeIndex + 1} / {steps.length}
                  </p>
                  <h3 id={titleId} className="mt-[8px] text-[15px] font-medium text-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-[8px] text-[13px] leading-relaxed text-text-secondary">
                    {step.body}
                  </p>
                  {step.combo !== null && (
                    <p className="mt-[12px] flex items-center gap-[8px] text-[13px] text-text-secondary">
                      <Kbd>{step.combo}</Kbd>
                      {step.comboDescription !== null && <span>{step.comboDescription}</span>}
                    </p>
                  )}
                  <div className="mt-[20px] flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={onSkip}>
                      bỏ qua
                    </Button>
                    <Button variant="primary" size="sm" onClick={onNext}>
                      tiếp theo
                    </Button>
                  </div>
                </>
              )
            )}
          </section>

          {showsDots && (
            <div
              role="group"
              aria-label="tiến độ hướng dẫn"
              className="pointer-events-auto mt-[8px] flex justify-center"
            >
              {steps.map((dot, index) => (
                <button
                  key={dot.id}
                  type="button"
                  onClick={() => {
                    onJump(index);
                  }}
                  aria-label={`tới bước ${index + 1}: ${dot.title}`}
                  aria-current={index === activeIndex ? 'step' : undefined}
                  className="flex h-[18px] w-[18px] items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app"
                >
                  <span
                    aria-hidden="true"
                    className={`h-[6px] w-[6px] rounded-full ${
                      index === activeIndex ? 'bg-accent' : 'bg-text-muted'
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isSkipChipVisible && (
        <div className="pointer-events-auto fixed right-[16px] top-[16px]">
          <Button variant="secondary" size="sm" onClick={onReopen}>
            xem hướng dẫn
          </Button>
        </div>
      )}
    </div>
  );
}
