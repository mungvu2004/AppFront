/**
 * Canvas xem trước bên phải của giai đoạn 2 — hình học sẽ được nhập, tô theo
 * vai trò đã gán cho lớp chứa nó.
 *
 * View thuần của mục D (R-60): mọi thứ vào bằng {@link CadLayerPreviewCanvasProps},
 * không `src/api`, không `src/store`, không `src/domain`, không `src/lib/http`.
 *
 * ## Vì sao không có nút "áp dụng"
 *
 * Canvas là một hàm thuần của `model.entities` và `model.layers`. Đổi vai trò
 * một lớp là đổi `layer.role`, và nét của mọi thực thể thuộc lớp đó lấy màu mới
 * ngay trong cùng khung hình — không có bước gửi, không có bản nháp, không có
 * trạng thái trung gian nào để lệch. Hoà tan 260 ms (`duration-260`) là thứ duy
 * nhất đứng giữa hai màu; đặc tả gốc ghi 240 ms nhưng thang chuyển động của repo
 * chỉ có 120/180/260/340/700 (R-71, mục B) nên nấc gần nhất thắng.
 *
 * ## Vì sao màu CAD gốc không bao giờ xuất hiện ở đây
 *
 * Màu CAD gốc là chuyện của tệp, không phải chuyện của mô hình. Nó chỉ được vẽ
 * một ô nhỏ trong bảng lớp để người dùng nhận ra lớp mình đang nói tới. Trên
 * canvas, màu **là câu trả lời cho câu hỏi "cái này sẽ được nhập thành gì"** —
 * nên nó lấy từ vai trò, qua `@/components/canvas/materialMap`, nguồn thật duy
 * nhất của màu canvas. Hai nguồn màu trộn vào nhau thì canvas mất nghĩa: một
 * bức tường sẽ trông giống hệt một lớp bị bỏ qua chỉ vì người vẽ CAD chọn cùng
 * một màu bút.
 *
 * ## Vì sao tường cần `thicknessMm` còn sáu vai trò kia thì không
 *
 * Năm trên bảy vai trò lấy màu từ hàm không tham số của `materialMap`. Riêng
 * `wallStrokeToken` bắt buộc nhận một mức độ dày, vì chú giải độ dày tường ở góc
 * canvas nói ra bốn mức đó thành lời. Chọn cứng một mức cho mọi tường thì chú
 * giải nói dối về chính thứ đang được vẽ, nên độ dày đi kèm từng thực thể và do
 * cổng dữ liệu phát ra (xem `CadPreviewEntity.thicknessMm`).
 *
 * ## Nổi bật hai chiều
 *
 * Rê chuột lên một thực thể thì canvas phát **cả hai** `onHoverEntity(id)` và
 * `onHoverLayer(layerId)`: cái thứ nhất để canvas biết đúng nét nào đang được
 * trỏ, cái thứ hai để hàng lớp tương ứng trong bảng sáng lên. Chiều ngược lại đi
 * qua `model.hoveredLayerId`, do bảng đặt. Đường bàn phím của chiều đó nằm ở
 * `CadLayerMappingPanel` (tiêu điểm vào hàng), không ở đây — nét vẽ trên canvas
 * không phải chỗ đặt điểm dừng tab thứ hai cho cùng một việc.
 */

import { useMemo } from 'react';

import {
  dimensionStrokeToken,
  doorStrokeToken,
  furnitureStrokeToken,
  gridMinorToken,
  wallStrokeToken,
  windowStrokeToken,
} from '@/components/canvas/materialMap';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/lib/utils';

import { PREVIEW_CANVAS_ARIA_LABEL } from './cadBranchConfirmText';
import type {
  CadLayer,
  CadLayerPreviewCanvasProps,
  CadLayerRole,
  CadPreviewEntity,
  CadPreviewPoint,
} from './types';

/**
 * Nét của thứ sẽ **không** được nhập: lớp còn ở vai trò "Bỏ qua", và lớp mà
 * canvas không tìm thấy trong `model.layers`.
 *
 * `--wall-idle` là token "tường chưa được hỏi han gì" của bảng màu — cùng token
 * `src/lib/coloring` dùng cho mô hình chưa tô. `materialMap` không có hàm không
 * tham số trả về nó (`wallStrokeToken` luôn đòi một mức độ dày có thật), nên
 * token được gọi tên thẳng ở đây; nó là **tên biến CSS**, không phải mã màu, nên
 * A1 và `local/no-raw-color` không đụng tới.
 */
const IDLE_STROKE_TOKEN = 'var(--wall-idle)';

/** Nét thường, tính bằng pixel màn hình nhờ `vector-effect="non-scaling-stroke"`. */
const BASE_STROKE_WIDTH = 1.5;

/** Nét của thực thể đang được trỏ tới, hoặc thuộc lớp đang được trỏ tới. */
const ACTIVE_STROKE_WIDTH = 2.5;

/**
 * Vệt trong suốt rộng hơn nằm dưới mỗi nét, để trỏ trúng một đường 1,5 px không
 * đòi hỏi tay chính xác đến từng pixel.
 */
const HIT_AREA_STROKE_WIDTH = 10;

/** Độ mờ của thực thể thuộc lớp sẽ bị bỏ qua — thấy được, nhưng rõ là không được nhập. */
const IGNORED_OPACITY = 0.3;

/** Độ mờ của thực thể bị lu đi khi một lớp khác đang được nổi bật. */
const DIMMED_OPACITY = 0.25;

/** Vai trò của một lớp chưa được gán. */
const UNASSIGNED_ROLE: CadLayerRole = 'ignore';

/**
 * Token màu của một vai trò.
 *
 * Độ dày chỉ có nghĩa với vai trò `wall`; sáu vai trò còn lại nhận `null` và lấy
 * màu từ hàm không tham số tương ứng.
 */
function strokeTokenForRole(role: CadLayerRole, thicknessMm: CadPreviewEntity['thicknessMm']) {
  switch (role) {
    case 'wall':
      return thicknessMm === null ? IDLE_STROKE_TOKEN : wallStrokeToken(thicknessMm);
    case 'door':
      return doorStrokeToken();
    case 'window':
      return windowStrokeToken();
    case 'dimension':
      return dimensionStrokeToken();
    case 'grid':
      return gridMinorToken();
    case 'furniture':
      return furnitureStrokeToken();
    case 'ignore':
      return IDLE_STROKE_TOKEN;
    default:
      return IDLE_STROKE_TOKEN;
  }
}

/**
 * Giá trị màu dùng được trong CSS, từ một token của chú giải.
 *
 * `CadWallThicknessLegendEntry.colorToken` là "token màu giao diện" và hợp đồng
 * không chốt cách viết: `materialMap` trả về dạng đã bọc (`var(--wall-220)`),
 * còn `src/lib/coloring` gọi tên trần (`--wall-220`). Cả hai đều là token hợp
 * lệ, nên chỗ này nhận cả hai thay vì bắt một bên phải đổi — và vẫn không có mã
 * màu nào được viết ra ở đây.
 */
function cssColorOfToken(colorToken: string): string {
  return colorToken.startsWith('--') ? `var(${colorToken})` : colorToken;
}

/** Danh sách điểm của một thực thể, dựng thẳng thành thuộc tính `points` của SVG. */
function pointsAttribute(points: readonly CadPreviewPoint[]): string {
  return points.map(([xMm, yMm]) => `${xMm},${yMm}`).join(' ');
}

interface CadPreviewShapeProps {
  readonly entity: CadPreviewEntity;
  readonly layer: CadLayer | undefined;
  readonly isActive: boolean;
  readonly isDimmed: boolean;
  readonly onHoverEntity: (entityId: string | null) => void;
  readonly onHoverLayer: (layerId: string | null) => void;
}

function CadPreviewShape({
  entity,
  isActive,
  isDimmed,
  layer,
  onHoverEntity,
  onHoverLayer,
}: CadPreviewShapeProps) {
  const role = layer?.role ?? UNASSIGNED_ROLE;
  const points = pointsAttribute(entity.points);

  const opacity = isDimmed
    ? DIMMED_OPACITY
    : role === UNASSIGNED_ROLE
      ? IGNORED_OPACITY
      : 1;

  const handleEnter = (): void => {
    onHoverEntity(entity.id);
    onHoverLayer(entity.layerId);
  };

  const handleLeave = (): void => {
    onHoverEntity(null);
    onHoverLayer(null);
  };

  return (
    <g
      className="transition-opacity duration-180 motion-reduce:transition-none"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{ opacity }}
    >
      <polyline
        fill="none"
        points={points}
        stroke="transparent"
        strokeWidth={HIT_AREA_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        className="transition-colors duration-260 motion-reduce:transition-none"
        fill="none"
        points={points}
        stroke={strokeTokenForRole(role, entity.thicknessMm)}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={isActive ? ACTIVE_STROKE_WIDTH : BASE_STROKE_WIDTH}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

export function CadLayerPreviewCanvas({ actions, model }: CadLayerPreviewCanvasProps) {
  const { onHoverEntity, onHoverLayer } = actions;
  const {
    entities,
    extentMm,
    hoveredEntityId,
    hoveredLayerId,
    isLoading,
    layers,
    wallThicknessLegend,
  } = model;

  const layersById = useMemo(() => {
    const index = new Map<string, CadLayer>();

    for (const layer of layers) {
      index.set(layer.id, layer);
    }

    return index;
  }, [layers]);

  const widthMm = extentMm.maxXMm - extentMm.minXMm;
  const heightMm = extentMm.maxYMm - extentMm.minYMm;
  const hasDrawableExtent = widthMm > 0 && heightMm > 0 && entities.length > 0;
  const hasHighlight = hoveredLayerId !== null || hoveredEntityId !== null;

  return (
    <div className="relative h-full w-full flex-1 overflow-hidden rounded-[16px] border border-border-default bg-canvas-2d">
      {isLoading ? (
        <Skeleton className="absolute inset-0" preset="canvas" />
      ) : hasDrawableExtent ? (
        <svg
          aria-label={PREVIEW_CANVAS_ARIA_LABEL}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`${extentMm.minXMm} ${extentMm.minYMm} ${widthMm} ${heightMm}`}
        >
          {entities.map((entity) => {
            const isActive =
              hoveredEntityId === entity.id || hoveredLayerId === entity.layerId;

            return (
              <CadPreviewShape
                entity={entity}
                isActive={isActive}
                isDimmed={hasHighlight && !isActive}
                key={entity.id}
                layer={layersById.get(entity.layerId)}
                onHoverEntity={onHoverEntity}
                onHoverLayer={onHoverLayer}
              />
            );
          })}
        </svg>
      ) : null}

      {wallThicknessLegend.length === 0 ? null : (
        <ul
          className={cn(
            'absolute bottom-3 left-3 z-10 flex flex-col gap-1',
            'rounded-[12px] bg-bg-surface p-3 shadow-float',
          )}
        >
          {wallThicknessLegend.map((entry) => (
            <li className="flex items-center gap-2" key={entry.id}>
              <span
                aria-hidden="true"
                className="h-4 w-4 shrink-0 rounded-[3px]"
                style={{ backgroundColor: cssColorOfToken(entry.colorToken) }}
              />
              <span className="font-mono text-[12px] leading-none text-text-primary">
                {entry.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
