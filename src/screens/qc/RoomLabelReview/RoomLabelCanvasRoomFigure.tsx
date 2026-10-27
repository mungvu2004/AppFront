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

import { fitText } from '@/lib/export/fitText';
import { MOTION_EASINGS, cssDurationMs } from '@/lib/motion';

import {
  ROOM_LABEL_CANVAS_COPY,
  ROOM_LABEL_CODE_FONT_PX,
  ROOM_LABEL_LINE_OFFSET_PX,
  ROOM_LABEL_NAME_FONT_PX,
  ROOM_LABEL_TEXT_TOKEN,
  ROOM_SELECTED_STROKE_TOKEN,
  ROOM_SELECTED_STROKE_WIDTH_PX,
  ROOM_STROKE_TOKEN,
  ROOM_STROKE_WIDTH_PX,
  computeRoomBoundsPx,
  cssVar,
  pointToPx,
  roomOutlinePx,
  shortRoomName,
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

/**
 * Độ phủ nền phòng theo công năng. `DIMMED_OPACITY` (0,12) của `applyEmphasis` làm
 * phòng gần như biến mất trên bản vẽ (đánh giá A3: "không vẽ vùng phòng cho tới khi
 * chọn"), nên canvas Phòng dùng nấc riêng: thấy vùng ngay khi mở, nhãn vẫn ≥ 4,5:1.
 * Z/S-20: phòng tô rất nhạt (0,12) để bản vẽ gốc đọc được; phòng đang chọn 0,2 cộng viền nhấn 2px.
 * K15: không phóng hình khi chọn — đường bao phải nằm đúng chỗ người dùng đang kiểm.
 */
const ROOM_FILL_OPACITY = 0.12;
const ROOM_SELECTED_FILL_OPACITY = 0.2;

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

/** Tên cắt còn chừng này ký tự (kể cả "…") thì không đọc được — hiện tên ngắn hoặc mã phòng thay vào. */
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

  /*
   * BUG-623 + K16: thử tên đủ rồi tên ngắn ("phòng tắm 1" → "WC 1"); tên dài cắt bằng "…" theo bề
   * rộng phòng đang vẽ. Cắt còn vài chữ ("p…") là vô nghĩa: xuống cỡ nhỏ, rồi mới tới mã phòng.
   * Chữ hiện khác tên đủ thì tên đủ nằm ở `<title>`.
   */
  const nameText = room.hasName ? room.name : ROOM_LABEL_CANVAS_COPY.unnamedPlaceholder;
  const candidates = room.hasName ? [nameText, shortRoomName(nameText)] : [nameText];
  const fitsAt = (fontPx: number) => candidates.find((text) => fitText(text, fontPx, maxWidthPx) === text);
  const lastCandidate = candidates[candidates.length - 1] ?? nameText;
  const truncated = fitText(lastCandidate, ROOM_LABEL_NAME_FONT_PX, maxWidthPx);
  const isStub = truncated === '' || truncated.length <= MIN_NAME_GLYPHS;
  const largeText = room.labelFits ? (fitsAt(ROOM_LABEL_NAME_FONT_PX) ?? (isStub ? undefined : truncated)) : undefined;
  const titleOf = (shown: string) => (shown === nameText ? null : <title>{nameText}</title>);

  if (largeText === undefined) {
    const smallText = fitsAt(ROOM_LABEL_CODE_FONT_PX) ?? room.codeLabel;
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
        {titleOf(smallText)}
        {smallText}
      </text>
    );
  }

  /* K23: nhãn trên bản vẽ chỉ ghi tên — diện tích nằm ở danh sách và thanh tra, hai dòng chữ từng đè phòng bên. */
  return (
    <text
      className="motion-reduce:transition-none"
      fill={textToken}
      fontSize={ROOM_LABEL_NAME_FONT_PX}
      fontStyle={room.hasName ? 'normal' : 'italic'}
      fontWeight={600}
      {...LABEL_HALO}
      style={fadeStyle}
      textAnchor="middle"
      x={anchor.x}
      y={anchor.y}
    >
      {titleOf(largeText)}
      {largeText}
    </text>
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
  const anchor = labelAnchorFor(pointToPx(room.labelAnchorMm, millimetresPerPixel), bounds, outline, hasBackground);

  /* K15: chọn chỉ đổi nền và viền, không phóng hình; đổi màu trong 180 ms (R-71). */
  const polygonStyle = {
    transitionDuration: cssDurationMs('fast', { reducedMotion }),
    transitionProperty: 'fill-opacity, stroke, stroke-width',
    transitionTimingFunction: MOTION_EASINGS.enter.css,
  };

  return (
    <g aria-hidden="true" className="pointer-events-none motion-reduce:transition-none" role="presentation">
      <polygon
        fill={cssVar(room.fillToken)}
        fillOpacity={isSelected ? ROOM_SELECTED_FILL_OPACITY : ROOM_FILL_OPACITY}
        points={points}
        stroke={isSelected ? cssVar(ROOM_SELECTED_STROKE_TOKEN) : cssVar(ROOM_STROKE_TOKEN)}
        strokeWidth={isSelected ? ROOM_SELECTED_STROKE_WIDTH_PX : ROOM_STROKE_WIDTH_PX}
        style={polygonStyle}
        vectorEffect="non-scaling-stroke"
      />

      <RoomLabelText anchor={anchor} maxWidthPx={bounds.width} room={room} />
    </g>
  );
}
