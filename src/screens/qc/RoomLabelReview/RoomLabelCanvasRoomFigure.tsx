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
import { fitText } from '@/lib/export/fitText';
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
  /** Có bản vẽ nền: nhãn dời lên mép trên phòng để không đè chữ gốc ở giữa phòng (G4a-29). */
  readonly hasBackground?: boolean;
}

/** Khoảng cách từ mép trên phòng tới tâm nhãn khi dời nhãn (G4a-29). */
const TOP_LABEL_INSET_PX = ROOM_LABEL_NAME_FONT_PX + ROOM_LABEL_LINE_OFFSET_PX + 4;

/** Phép thử tia chuẩn: điểm có nằm trong đa giác (toạ độ px) không. */
function isInsidePolygon(point: { readonly x: number; readonly y: number }, polygon: readonly { readonly x: number; readonly y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Tên cắt còn chừng này ký tự (kể cả "…") thì không đọc được — hiện mã phòng thay vào. */
const MIN_NAME_GLYPHS = 4;

/**
 * G4a-29: bản vẽ gốc thường ghi tên phòng đúng giữa phòng, nên khi có nền nhãn của màn dời lên gần
 * mép trên (vẫn trong phòng) để người duyệt đọc được cả hai mà đối chiếu. Phòng thấp hoặc điểm mới
 * rơi ra ngoài đa giác (phòng chữ L) thì giữ điểm neo cũ.
 */
function labelAnchorFor(
  anchor: { readonly x: number; readonly y: number },
  bounds: { readonly y: number; readonly height: number },
  outline: readonly { readonly x: number; readonly y: number }[],
  hasBackground: boolean,
) {
  if (!hasBackground || bounds.height < TOP_LABEL_INSET_PX * 3) {
    return anchor;
  }
  const moved = { x: anchor.x, y: bounds.y + TOP_LABEL_INSET_PX };
  return isInsidePolygon(moved, outline) ? moved : anchor;
}

/** Viền chữ màu nền: nhãn đọc được cả khi nằm trên nét bản vẽ. */
const LABEL_HALO = {
  paintOrder: 'stroke',
  stroke: cssVar('--bg-surface'),
  strokeWidth: 3,
  strokeLinejoin: 'round',
} as const;

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
  maxWidthPx,
}: {
  readonly room: RoomLabelViewModel;
  readonly anchor: { readonly x: number; readonly y: number };
  /** Bề rộng phòng ở tỷ lệ HIỂN THỊ — `labelFits` đo ở tỷ lệ bản vẽ, khác tỷ lệ vừa khung (BUG-393, BUG-623). */
  readonly maxWidthPx: number;
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

  /* BUG-623: tên dài cắt bằng dấu "…" theo bề rộng phòng đang vẽ, tên đầy đủ ở `<title>`. */
  const nameText = room.hasName ? room.name : ROOM_LABEL_CANVAS_COPY.unnamedPlaceholder;
  const fittedName = fitText(nameText, ROOM_LABEL_NAME_FONT_PX, maxWidthPx);
  /* Cắt còn vài chữ ("p…", "ph…") là vô nghĩa: phòng vẽ quá nhỏ thì hiện mã phòng, tên ở `<title>`. */
  const isNameStub = fittedName !== nameText && fittedName.length <= MIN_NAME_GLYPHS;

  if (!room.labelFits || fittedName === '' || isNameStub) {
    return (
      <text
        className="motion-reduce:transition-none"
        fill={textToken}
        fontSize={ROOM_LABEL_CODE_FONT_PX}
        {...LABEL_HALO}
        style={fadeStyle}
        textAnchor="middle"
        x={anchor.x}
        y={anchor.y}
      >
        {isNameStub ? <title>{nameText}</title> : null}
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
        {...LABEL_HALO}
        textAnchor="middle"
        x={anchor.x}
        y={anchor.y - ROOM_LABEL_LINE_OFFSET_PX}
      >
        {fittedName === nameText ? null : <title>{nameText}</title>}
        {fittedName}
      </text>
      <text
        fill={textToken}
        fontSize={ROOM_LABEL_AREA_FONT_PX}
        {...LABEL_HALO}
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
  hasBackground = false,
}: RoomLabelCanvasRoomFigureProps) {
  const outline = roomOutlinePx(room, millimetresPerPixel);
  const points = svgPointsAttr(outline);
  const bounds = computeRoomBoundsPx(room, millimetresPerPixel);
  const centre = centreOfBounds(bounds);
  const anchor = labelAnchorFor(pointToPx(room.labelAnchorMm, millimetresPerPixel), bounds, outline, hasBackground);

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

      <RoomLabelText anchor={anchor} maxWidthPx={bounds.width} room={room} />
    </g>
  );
}
