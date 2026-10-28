/**
 * Một ký hiệu đối tượng trên canvas lớp đối tượng — tách khỏi `ObjectLayerCanvas.tsx`
 * (gate độ dài). Z/S-16: hình nói loại, màu nét nói trạng thái, dấu ✓ cho mục đã duyệt.
 */

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

import { staggerDelayMs } from '@/lib/motion';
import { cn } from '@/lib/utils';

import {
  OBJECT_CANVAS_TEXT,
  OBJECT_LAYER_STROKE_STYLES,
  SYMBOL_WASH_OPACITY,
  buildObjectSymbol,
  objectLayerColorToken,
  type ObjectPlacementViewModel,
} from './objectLayerSymbols';

/* -------------------------------------------------------------------------- */
/* Một ký hiệu.                                                                */
/* -------------------------------------------------------------------------- */

interface ObjectSymbolFigureProps {
  readonly placement: ObjectPlacementViewModel;
  readonly isSelected: boolean;
  readonly isHovered: boolean;
  readonly isLayerVisible: boolean;
  readonly isInteractive: boolean;
  /** Thứ tự trong LỚP của nó — độ so le 24 ms đếm theo lớp vừa bật/tắt. */
  readonly layerIndex: number;
  readonly onSelect: (objectId: string | null) => void;
  readonly onHover: (objectId: string | null) => void;
  readonly onOpenMenu: (event: ReactMouseEvent<SVGGElement>, objectId: string) => void;
  readonly unitPx: number;
}

/**
 * Một đối tượng: nền 6%, các nét viền 1px, cộng hai nhịp chuyển động (bật/tắt
 * lớp và đổi loại). Cả hai nhịp giải thích ở mục "GHI CHÚ THIẾT KẾ CỦA LỚP
 * CANVAS" của `objectLayerSymbols.ts`.
 */
const SELECTED_TOKEN = 'var(--accent)';
const REVIEWED_TOKEN = 'var(--state-verified)';
const ATTENTION_TOKEN = 'var(--state-attention)';
/** Gợi ý của máy chưa nhận (B3): nét đứt đè lên kiểu nét của lớp. */
const SUGGESTED_DASH = '6 4';

export function ObjectSymbolFigure({
  placement,
  isSelected,
  isHovered,
  isLayerVisible,
  isInteractive,
  layerIndex,
  onSelect,
  onHover,
  onOpenMenu,
  unitPx,
}: ObjectSymbolFigureProps) {
  const symbol = buildObjectSymbol({
    subtype: placement.subtype,
    swing: placement.swing,
    width: placement.widthPx,
    depth: placement.depthPx,
  });
  /*
   * Z/S-16: hình nói loại, màu nói trạng thái — accent = đang chọn, xanh = người đã duyệt (A5),
   * vàng = cần xem (tin cậy thấp / chưa gắn tường). Mục bình thường giữ màu lớp trung tính.
   */
  const isReviewed = placement.statusCode === 'verified';
  const token = isSelected
    ? SELECTED_TOKEN
    : isReviewed
      ? REVIEWED_TOKEN
      : placement.statusCode === 'attention'
        ? ATTENTION_TOKEN
        : objectLayerColorToken(placement.layer);
  const strokeStyle = OBJECT_LAYER_STROKE_STYLES[placement.layer];
  const previousShapeRef = useRef(`${placement.subtype}/${placement.swing}`);
  const [isMorphing, setIsMorphing] = useState(false);

  useEffect(() => {
    const shape = `${placement.subtype}/${placement.swing}`;

    if (previousShapeRef.current === shape) {
      return undefined;
    }

    previousShapeRef.current = shape;
    setIsMorphing(true);

    const frame = requestAnimationFrame(() => setIsMorphing(false));

    return () => cancelAnimationFrame(frame);
  }, [placement.subtype, placement.swing]);

  return (
    <g
      aria-hidden={isLayerVisible ? undefined : 'true'}
      aria-label={placement.codeLabel}
      className={cn(
        'transition-[opacity,transform] duration-260 motion-reduce:transition-none',
        isLayerVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
        isInteractive && isLayerVisible ? 'cursor-pointer' : 'pointer-events-none',
      )}
      onClick={isInteractive ? () => onSelect(placement.id) : undefined}
      onContextMenu={isInteractive ? (event) => onOpenMenu(event, placement.id) : undefined}
      onMouseEnter={isInteractive ? () => onHover(placement.id) : undefined}
      onMouseLeave={isInteractive ? () => onHover(null) : undefined}
      role="presentation"
      style={{
        transform: isLayerVisible ? 'translateY(0)' : 'translateY(4px)',
        transitionDelay: `${staggerDelayMs(layerIndex)}ms`,
      }}
    >
      {/* Đặt chỗ bằng THUỘC TÍNH `transform` của SVG: lớp `scale-…` bên trong ghi vào `transform` CSS, chung chỗ thì nuốt nhau. */}
      <g transform={`translate(${placement.centrePx.x} ${placement.centrePx.y}) rotate(${placement.angleDeg})`}>
        <g
          className={cn(
            'origin-center transition-[opacity,transform] duration-260 motion-reduce:transition-none',
            isMorphing ? 'scale-90 opacity-0' : 'scale-100 opacity-100',
          )}
        >
          <path
            className="transition-colors duration-260 motion-reduce:transition-none"
            d={symbol.footprint}
            fill={token}
            fillOpacity={SYMBOL_WASH_OPACITY}
          />

          {symbol.strokes.map((stroke) => (
            <path
              className="transition-colors duration-260 motion-reduce:transition-none"
              d={stroke.d}
              fill="none"
              key={stroke.id}
              stroke={token}
              strokeDasharray={
                placement.isSuggested === true ? SUGGESTED_DASH : (stroke.dashArray ?? strokeStyle.dashArray ?? undefined)
              }
              strokeWidth={isSelected || isHovered ? strokeStyle.widthPx * 2 : strokeStyle.widthPx}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </g>

      {/* Dấu ✓ ở đầu ký hiệu đã duyệt (cỡ cố định trên màn): trạng thái không chỉ nằm ở màu. */}
      {isReviewed && !isSelected ? (
        <g aria-hidden="true" transform={`translate(${placement.centrePx.x} ${placement.centrePx.y}) rotate(${placement.angleDeg}) translate(${placement.widthPx / 2} 0) rotate(${-placement.angleDeg}) scale(${unitPx})`}>
          <circle fill={REVIEWED_TOKEN} r={7} />
          <path d="M -3.5 0 L -1 2.5 L 3.5 -2.5" fill="none" stroke="var(--bg-surface)" strokeLinecap="round" strokeWidth={1.6} />
        </g>
      ) : null}

      {/* Nhãn "Gợi ý" trên mép ký hiệu (cỡ cố định trên màn): trạng thái không chỉ nằm ở nét đứt. */}
      {placement.isSuggested === true ? (
        <text
          fill={token}
          fontSize={11}
          textAnchor="middle"
          transform={`translate(${placement.centrePx.x} ${placement.centrePx.y - placement.depthPx / 2}) scale(${unitPx}) translate(0 -4)`}
        >
          {OBJECT_CANVAS_TEXT.suggestionLabel}
        </text>
      ) : null}

      {placement.isOrphan ? (
        <circle
          cx={placement.centrePx.x}
          cy={placement.centrePx.y}
          fill="var(--state-attention)"
          r={5 * unitPx}
        >
          <title>{OBJECT_CANVAS_TEXT.orphanTitle}</title>
        </circle>
      ) : null}
    </g>
  );
}
