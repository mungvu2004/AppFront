/**
 * "Vừa khung" của canvas Quản lý trục — tách khỏi `AxisGridCanvas.tsx` để file
 * component chỉ xuất component (fast refresh), và để kiểm được không cần DOM.
 */
import type { AxisCanvasViewModel } from './axisGridTypes';

export interface CanvasFit {
  readonly viewBox: string;
  /** Số đơn vị `viewBox` ứng với MỘT px màn — nét, bong bóng, chữ nhân với nó để giữ đúng cỡ px ở mọi tỷ lệ bản vẽ. */
  readonly unit: number;
}

/**
 * `viewBox` = hộp bao lưới cộng lề `marginPx` tính theo px MÀN, và cỡ
 * một px màn trong đơn vị `viewBox`. Chưa đo được khung (jsdom, lần vẽ đầu) thì
 * coi một đơn vị là một px. Kỹ thuật dựng hình thuần (như `object-fit: contain`),
 * không phải hình học nghiệp vụ.
 *
 * Hộp bao rỗng (tầng chưa có trục, chưa có tường) mà khung đã đo được: viewBox
 * bằng ĐÚNG khung, căn tâm vào hộp, một đơn vị là một px — trước đây viewBox chỉ
 * rộng 2 × lề, SVG phóng mấy chục lần và dấu gốc "0,0" cao ~90 px (BUG-404).
 */
export function fitCanvas(
  bounds: AxisCanvasViewModel['boundsPx'],
  frame: { readonly width: number; readonly height: number },
  marginPx: number,
  /** Lề thêm ở đáy (px màn) cho cụm thu phóng nổi ở góc dưới phải — để nó không che bong bóng trục. */
  bottomReservePx = 0,
): CanvasFit {
  const usableWidth = frame.width - marginPx * 2;
  const usableHeight = frame.height - marginPx * 2 - bottomReservePx;
  const measured =
    usableWidth > 0 && usableHeight > 0 ? Math.max(bounds.width / usableWidth, bounds.height / usableHeight) : 0;
  const unit = measured > 0 ? measured : 1;

  if (bounds.width <= 0 && bounds.height <= 0 && frame.width > 0 && frame.height > 0) {
    const centreX = bounds.x + bounds.width / 2;
    const centreY = bounds.y + bounds.height / 2;

    return { unit, viewBox: `${centreX - frame.width / 2} ${centreY - frame.height / 2} ${frame.width} ${frame.height}` };
  }

  const pad = marginPx * unit;

  return {
    unit,
    viewBox: `${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2 + bottomReservePx * unit}`,
  };
}
