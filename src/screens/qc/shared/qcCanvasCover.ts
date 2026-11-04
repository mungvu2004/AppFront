import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Panel chi tiết nổi đè lên bản vẽ (bố cục `column` của `QcWorkspace`): khung vẽ không đổi khổ khi chọn/bỏ chọn,
 * nên mức phóng đứng yên. `QcCanvasCover` là phần khung đang bị che, pixel CSS, tính từ mép phải và mép dưới.
 * Chrome nổi và việc canh mục chọn đọc nó qua context; ngoài `QcWorkspace` thì bằng 0.
 */
export interface QcCanvasCover {
  readonly right: number;
  readonly bottom: number;
}

interface RectPx {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const NO_COVER: QcCanvasCover = { right: 0, bottom: 0 };

export const QcCanvasCoverContext = createContext<QcCanvasCover>(NO_COVER);
export const useQcCanvasCover = (): QcCanvasCover => useContext(QcCanvasCoverContext);

/** Đo phần `dock` che `section`: panel ở nửa phải là che mép phải (từ 1024), còn lại là tấm đáy (dưới 1024). */
export function useMeasuredCanvasCover(
  section: RefObject<HTMLElement | null>,
  dock: RefObject<HTMLElement | null>,
  isOpen: boolean,
): QcCanvasCover {
  const [cover, setCover] = useState(NO_COVER);

  useLayoutEffect(() => {
    const read = () => {
      const frame = section.current?.getBoundingClientRect();
      const panel = isOpen ? dock.current?.getBoundingClientRect() : undefined;
      let next = NO_COVER;

      if (frame !== undefined && panel !== undefined && panel.width > 0) {
        next = panel.left > frame.left + frame.width / 2
          ? { right: frame.right - panel.left, bottom: 0 }
          : { right: 0, bottom: frame.bottom - panel.top };
      }
      setCover((previous) => (previous.right === next.right && previous.bottom === next.bottom ? previous : next));
    };

    read();
    if (section.current === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(read);
    observer.observe(section.current);
    /* "So sánh" dưới 1024: `isOpen` đã đúng từ trước, tấm đáy chỉ hiện ra lúc chọn. */
    if (dock.current !== null) observer.observe(dock.current);
    return () => observer.disconnect();
  }, [dock, isOpen, section]);

  return cover;
}

/** Mục đứng cách mép phần thấy được chừng này thì coi là còn thấy, không dịch. */
const REVEAL_EDGE_PX = 8;
/** Phải dịch thì chừa chừng này tới mép, đủ chỗ cho thẻ đường dẫn. */
const REVEAL_PAD_PX = 48;

const revealAlong = (start: number, size: number, visible: number): number => {
  if (start >= REVEAL_EDGE_PX && start + size <= visible - REVEAL_EDGE_PX) return 0;
  /* Mục dài hơn phần thấy được: tâm còn thấy thì đứng yên (đừng giật cả bản vẽ vì đoạn tường dài), không thì đưa tâm vào giữa. */
  if (size + REVEAL_PAD_PX * 2 > visible) {
    const centre = start + size / 2;
    return centre >= 0 && centre <= visible ? 0 : visible / 2 - centre;
  }
  return start < REVEAL_PAD_PX ? REVEAL_PAD_PX - start : visible - REVEAL_PAD_PX - start - size;
};

/** Độ dịch (pixel khung) đưa `rect` ra khỏi phần bị che; không đụng mức phóng. */
export const revealDeltaOf = (
  rect: RectPx,
  frame: { readonly width: number; readonly height: number },
  cover: QcCanvasCover,
): { readonly x: number; readonly y: number } => ({
  x: revealAlong(rect.x, rect.width, frame.width - cover.right),
  y: revealAlong(rect.y, rect.height, frame.height - cover.bottom),
});

/**
 * Chọn một mục mà nó nằm dưới panel thì dịch bản vẽ cho lộ ra: một lần mỗi lần chọn, sau đó người dùng kéo đi đâu thì tuỳ.
 * Đợi một khung hình: "So sánh" vừa phóng tới mục trong hiệu ứng của hook màn, `rect` phải là của khung nhìn mới.
 */
export function useRevealSelection(
  selectionKey: string | null,
  frameRef: RefObject<HTMLElement | null>,
  rect: RectPx | null,
  panBy: (dx: number, dy: number) => void,
): void {
  const { right, bottom } = useQcCanvasCover();
  const latest = useRef({ rect, panBy });
  latest.current = { rect, panBy };
  const doneRef = useRef<string | null>(null);
  const key = selectionKey === null || (right === 0 && bottom === 0) ? null : `${selectionKey}:${right}:${bottom}`;

  useEffect(() => {
    if (key === null) doneRef.current = null;
    if (key === null || key === doneRef.current) return undefined;
    const raf = requestAnimationFrame(() => {
      const frame = frameRef.current;
      const target = latest.current.rect;
      if (frame === null || target === null) return;
      doneRef.current = key;
      const delta = revealDeltaOf(target, { width: frame.clientWidth, height: frame.clientHeight }, { right, bottom });
      if (delta.x !== 0 || delta.y !== 0) latest.current.panBy(delta.x, delta.y);
    });
    return () => cancelAnimationFrame(raf);
  }, [bottom, frameRef, key, right]);
}
