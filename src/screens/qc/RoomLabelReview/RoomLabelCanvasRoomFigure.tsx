/**
 * Một đa giác phòng của canvas — nền công năng RẤT NHẠT + viền + nhãn hai dòng
 * giữa phòng, hoặc nhãn rút gọn khi phòng quá nhỏ.
 *
 * Tách khỏi `RoomLabelCanvas.tsx` khi file đó chạm trần 400 dòng của R-22,
 * đúng khuôn `WallLayerShapeFigure.tsx`/`ObjectSymbolFigure` của hai màn anh
 * em (`RoomLabelCanvas.tsx`).
 *
 * THUẦN TRANG TRÍ: `pointer-events-none` và không mang `role`/`tabIndex` nào —
 * phần tử THẬT sự chọn được bằng chuột lẫn bàn phím là nút HTML vô hình mà
 * `RoomLabelCanvas.tsx` vẽ đè lên, không phải `<g>` này. Lý do tách hai lớp:
 * một `<button>` HTML thật cho vòng tiêu điểm (`focus-visible:ring-2`) luôn
 * hiện đúng như `expectAccessible` mong đợi (A12/R-72), trong khi vẽ vòng
 * tiêu điểm trực tiếp trên một `<g>` SVG bằng `outline`/`ring` không chắc
 * dựng đúng hộp CSS trên mọi trình duyệt.
 */

import { useEffect, useRef, useState } from 'react';

import { applyEmphasis } from '@/lib/coloring/legend';
import { MOTION_EASINGS, cssDurationMs } from '@/lib/motion';

import {
  ROOM_LABEL_AREA_FONT_PX,
  ROOM_LABEL_CANVAS_COPY,
  ROOM_LABEL_CODE_FONT_PX,
  ROOM_LABEL_LINE_OFFSET_PX,
  ROOM_LABEL_NAME_FONT_PX,
  ROOM_LABEL_TEXT_TOKEN,
  ROOM_SELECTED_SCALE,
  ROOM_SELECTED_STROKE_TOKEN,
  ROOM_SELECTED_STROKE_WIDTH_PX,
  ROOM_STROKE_TOKEN,
  ROOM_STROKE_WIDTH_PX,
  centreOfBounds,
  computeRoomBoundsPx,
  cssVar,
  pointToPx,
  roomOutlinePx,
  svgPointsAttr,
} from './roomLabelCanvasGeometry';
import type { RoomLabelViewModel } from './roomLabelTypes';

export interface RoomLabelCanvasRoomFigureProps {
  readonly room: RoomLabelViewModel;
  readonly isSelected: boolean;
  readonly millimetresPerPixel: number;
  readonly reducedMotion: boolean;
}

/**
 * Nhãn giữa phòng: hai dòng (tên + diện tích) khi hộp trong lớn nhất của
 * phòng đủ chỗ ({@link RoomLabelViewModel.labelFits}); khi không đủ, canvas
 * KHÔNG ẩn trắng — nó vẫn vẽ MỘT dòng mã phòng cỡ nhỏ (`codeLabel`) tại đúng
 * điểm neo, để người dùng còn cách nhận ra phòng nào là phòng nào ngay trên
 * bản vẽ mà không cần rời mắt sang danh sách bên trái. Quyết định này (mã
 * thay vì ẩn hẳn) là lựa chọn của T6 — xem báo cáo worker_done.
 */
function RoomLabelText({
  room,
  anchor,
}: {
  readonly room: RoomLabelViewModel;
  readonly anchor: { readonly x: number; readonly y: number };
}) {
  const textToken = cssVar(ROOM_LABEL_TEXT_TOKEN);

  /*
   * Đổi tên: nhãn hoà tan trong 180 ms (R-71). Theo đúng khuôn `isMorphing`
   * của `ObjectSymbolFigure`: gắn nhãn mới ở opacity 0, rồi bật opacity ở
   * frame kế tiếp để trình duyệt có một trạng thái xuất phát để chuyển động
   * từ đó — gán thẳng "opacity-100" ngay từ đầu sẽ không có gì để hoà tan.
   */
  const previousNameRef = useRef(room.name);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (previousNameRef.current === room.name) {
      return undefined;
    }

    previousNameRef.current = room.name;
    setIsRenaming(true);

    const frame = requestAnimationFrame(() => setIsRenaming(false));

    return () => cancelAnimationFrame(frame);
  }, [room.name]);

  const fadeStyle = {
    opacity: isRenaming ? 0 : 1,
    transitionDuration: cssDurationMs('fast'),
    transitionProperty: 'opacity',
    transitionTimingFunction: MOTION_EASINGS.enter.css,
  };

  if (!room.labelFits) {
    return (
      <text
        className="motion-reduce:transition-none"
        fill={textToken}
        fontSize={ROOM_LABEL_CODE_FONT_PX}
        style={fadeStyle}
        textAnchor="middle"
        x={anchor.x}
        y={anchor.y}
      >
        {room.codeLabel}
      </text>
    );
  }

  return (
    <g className="motion-reduce:transition-none" style={fadeStyle}>
      <text
        fill={textToken}
        fontSize={ROOM_LABEL_NAME_FONT_PX}
        fontStyle={room.hasName ? 'normal' : 'italic'}
        fontWeight={600}
        textAnchor="middle"
        x={anchor.x}
        y={anchor.y - ROOM_LABEL_LINE_OFFSET_PX}
      >
        {room.hasName ? room.name : ROOM_LABEL_CANVAS_COPY.unnamedPlaceholder}
      </text>
      <text
        fill={textToken}
        fontSize={ROOM_LABEL_AREA_FONT_PX}
        textAnchor="middle"
        x={anchor.x}
        y={anchor.y + ROOM_LABEL_LINE_OFFSET_PX}
      >
        {room.areaText}
      </text>
    </g>
  );
}

export function RoomLabelCanvasRoomFigure({
  room,
  isSelected,
  millimetresPerPixel,
  reducedMotion,
}: RoomLabelCanvasRoomFigureProps) {
  const points = svgPointsAttr(roomOutlinePx(room, millimetresPerPixel));
  const bounds = computeRoomBoundsPx(room, millimetresPerPixel);
  const centre = centreOfBounds(bounds);
  const anchor = pointToPx(room.labelAnchorMm, millimetresPerPixel);

  /*
   * "Nâng lên 10%": phòng đang chọn phóng to quanh tâm hộp bao của CHÍNH NÓ,
   * chạy trong 180 ms (R-71) — cùng nhịp với "đa giác to dần" của đặc tả.
   * Gốc phóng to đặt bằng toạ độ px tường minh (`transformOrigin`) thay vì
   * `transform-box: fill-box`, để không phụ thuộc một tính năng CSS mới của
   * trình duyệt cho một phép biến hình vốn chỉ cần cộng/trừ đơn giản.
   */
  const groupStyle = {
    transform: isSelected ? `scale(${ROOM_SELECTED_SCALE})` : 'scale(1)',
    transformOrigin: `${centre.x}px ${centre.y}px`,
    transitionDuration: cssDurationMs('fast', { reducedMotion }),
    transitionProperty: 'transform',
    transitionTimingFunction: MOTION_EASINGS.enter.css,
  };

  const fill = applyEmphasis(room.fillToken, 'dimmed');

  return (
    <g aria-hidden="true" className="pointer-events-none motion-reduce:transition-none" role="presentation">
      <g style={groupStyle}>
        <polygon
          fill={cssVar(fill.token)}
          fillOpacity={fill.opacity}
          points={points}
          stroke={isSelected ? cssVar(ROOM_SELECTED_STROKE_TOKEN) : cssVar(ROOM_STROKE_TOKEN)}
          strokeWidth={isSelected ? ROOM_SELECTED_STROKE_WIDTH_PX : ROOM_STROKE_WIDTH_PX}
          vectorEffect="non-scaling-stroke"
        />
      </g>

      <RoomLabelText anchor={anchor} room={room} />
    </g>
  );
}
