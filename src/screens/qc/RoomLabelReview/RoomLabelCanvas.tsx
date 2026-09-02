/**
 * Canvas giữa của màn QC "Duyệt tên phòng" — mặt bằng 2D vẽ phòng thành đa
 * giác tô RẤT NHẠT theo công năng, nhãn hai dòng giữa phòng, chọn được bằng
 * chuột lẫn bàn phím.
 *
 * View THUẦN của mục D (R-60): mọi thứ vào bằng `RoomLabelCanvasProps`
 * (`roomLabelTypes.ts`, đóng băng, T4), không `src/api`, không `src/store`,
 * không `src/domain`, không `src/lib/http` — kể cả một dòng `import type`,
 * cùng kỷ luật mà `WallLayerCanvas.tsx`/`ObjectLayerCanvas.tsx` đã giữ (đọc
 * lại kiểu id từ chính hợp đồng props thay vì nhập `RoomId` của
 * `@/domain/spatial/types`).
 *
 * `roomLabelCanvasGeometry.ts` giữ phần quy đổi mm↔px và mọi hằng số dựng
 * hình (đọc trước khi sửa: vì sao canvas này TỰ quy đổi đơn vị, khác hai
 * canvas anh em). `RoomLabelCanvasRoomFigure.tsx` giữ một đa giác phòng.
 *
 * ## Hai lớp cho MỘT phòng — vì sao
 *
 * Mỗi phòng vẽ hai lần: một `<g>` SVG thuần trang trí
 * (`RoomLabelCanvasRoomFigure`, `pointer-events-none`) và một `<button>` HTML
 * vô hình đè lên đúng hộp bao của nó. Bàn phím là đường đi hạng nhất (A12) —
 * phòng phải Tab tới được và Enter/Space chọn được, và vòng tiêu điểm phải
 * THẬT SỰ hiện trên mọi trình duyệt. Một `<button>` cho miễn phí cả hai điều
 * đó (focus-visible ring dựng đúng hộp CSS, Enter/Space tự kích hoạt
 * `onClick`); vẽ vòng tiêu điểm trực tiếp trên một `<g>`/`<polygon>` SVG bằng
 * `ring-2` (lớp `box-shadow` của Tailwind) không chắc dựng đúng trên mọi
 * trình duyệt vì SVG không luôn có hộp CSS như phần tử HTML. Đây là giới hạn
 * thật của nút chọn theo HỘP BAO (không theo đúng biên đa giác): với bộ mẫu
 * hiện tại (phòng hình chữ nhật liền kề, không chồng) hộp bao trùng khít biên
 * thật; một phòng đa giác lồi lõm trong tương lai có thể khiến hộp bao của
 * hai phòng cạnh nhau chồng lấn nhẹ — chấp nhận được vì lớp `<g>` trang trí
 * vẫn vẽ đúng biên thật, chỉ vùng BẤM lệch, không phải hình vẽ lệch.
 *
 * ## Camera — dịch tới phòng được chọn
 *
 * Không có prop `viewport`/`zoom` nào trong hợp đồng (khác
 * `WallLayerCanvasViewProps`), nên canvas này KHÔNG có phóng to/thu nhỏ theo
 * yêu cầu người dùng — chỉ một phép DỊCH CHUYỂN (translate) trên một `<div>`
 * HTML thuần bọc ảnh nền và `<svg>`, đúng kỹ thuật của `WallLayerCanvas.tsx`
 * (dòng 308-317): chuyển động đặt trên CSS của một phần tử HTML, không trên
 * `transform` bên trong hệ toạ độ đã bị `viewBox` co giãn, để không phải đoán
 * đơn vị `px` trong `transform` SVG được trình duyệt quy về hệ nào.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { SelectionHalo } from '@/components/canvas/SelectionHalo';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useSelectionHalo } from '@/hooks/useSelectionHalo';
import { MOTION_EASINGS, cssDurationMs } from '@/lib/motion';

import { RoomLabelCanvasRoomFigure } from './RoomLabelCanvasRoomFigure';
import {
  BACKGROUND_IMAGE_OPACITY,
  ROOM_LABEL_CANVAS_COPY,
  ROOM_LABEL_CANVAS_FRAME_CLASSES,
  centreOfBounds,
  computeContentBoundsPx,
  computeRoomBoundsPx,
  type RoomLabelBoundsPx,
  type RoomLabelRoomId,
} from './roomLabelCanvasGeometry';
import type { RoomLabelCanvasProps } from './roomLabelTypes';

const FORBIDDEN_DESCRIPTION_ID = 'room-label-canvas-forbidden';

/** Điểm dịch chuyển `(0, 0)` — trạng thái nghỉ trước khi đo được khung. */
const ORIGIN = { x: 0, y: 0 };

export function RoomLabelCanvas({
  rooms,
  selectedRoomId,
  hoveredRoomId,
  millimetresPerPixel,
  backgroundImageUrl,
  backgroundImageAlt,
  isInteractive,
  onSelect,
  onHover,
}: RoomLabelCanvasProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const halo = useSelectionHalo();
  const reducedMotion = useReducedMotion();
  const { select: haloSelect, hover: haloHover, deselect: haloDeselect } = halo;

  useEffect(() => {
    const frame = frameRef.current;

    if (frame === null) {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry !== undefined) {
        setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });

    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (selectedRoomId !== null) {
      haloSelect();
    } else if (hoveredRoomId !== null) {
      haloHover();
    } else {
      haloDeselect();
    }
  }, [selectedRoomId, hoveredRoomId, haloSelect, haloHover, haloDeselect]);

  const contentBounds = useMemo(
    () => computeContentBoundsPx(rooms, millimetresPerPixel),
    [rooms, millimetresPerPixel],
  );

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const hoveredRoom = rooms.find((room) => room.id === hoveredRoomId) ?? null;
  const activeRoom = selectedRoom ?? hoveredRoom;
  const activeBounds: RoomLabelBoundsPx | null =
    activeRoom === null ? null : computeRoomBoundsPx(activeRoom, millimetresPerPixel);

  /*
   * "Canvas dịch mượt tới phòng được chọn": không chọn gì thì camera đứng
   * giữa TOÀN BỘ mặt bằng; chọn một phòng thì tâm hộp bao của phòng đó trôi
   * về đúng tâm khung. 'slow' (340 ms) — đúng nhóm "view change, camera move"
   * của bảng bốn tốc độ (`src/lib/motion/tokens.ts`), không phải 'fast' của
   * nhịp chọn/nhãn.
   */
  const panPx = useMemo(() => {
    if (contentBounds === null) {
      return ORIGIN;
    }

    const focusBounds = selectedRoom === null ? contentBounds : computeRoomBoundsPx(selectedRoom, millimetresPerPixel);
    const focusCentre = centreOfBounds(focusBounds);
    const localCentreX = focusCentre.x - contentBounds.x;
    const localCentreY = focusCentre.y - contentBounds.y;

    return { x: frameSize.width / 2 - localCentreX, y: frameSize.height / 2 - localCentreY };
  }, [contentBounds, frameSize, millimetresPerPixel, selectedRoom]);

  const handleFrameMouseLeave = useCallback(() => onHover(null), [onHover]);

  return (
    <div
      aria-describedby={isInteractive ? undefined : FORBIDDEN_DESCRIPTION_ID}
      aria-label={ROOM_LABEL_CANVAS_COPY.canvasLabel}
      className={ROOM_LABEL_CANVAS_FRAME_CLASSES}
      onMouseLeave={handleFrameMouseLeave}
      ref={frameRef}
      role="group"
    >
      {contentBounds === null ? (
        <div
          aria-label={ROOM_LABEL_CANVAS_COPY.waitingFrameLabel}
          className="absolute inset-3 rounded-[12px] bg-bg-sunken"
          role="img"
        />
      ) : (
        <div
          className="absolute left-0 top-0 origin-top-left motion-reduce:transition-none"
          style={{
            height: contentBounds.height,
            transform: `translate(${panPx.x}px, ${panPx.y}px)`,
            transitionDuration: cssDurationMs('slow', { reducedMotion }),
            transitionProperty: 'transform',
            transitionTimingFunction: MOTION_EASINGS.enter.css,
            width: contentBounds.width,
          }}
        >
          {backgroundImageUrl === null ? (
            <div aria-hidden="true" className="absolute inset-0 bg-bg-sunken" />
          ) : (
            <img
              alt={backgroundImageAlt}
              className="pointer-events-none absolute inset-0 block h-full w-full select-none"
              draggable={false}
              src={backgroundImageUrl}
              style={{ opacity: BACKGROUND_IMAGE_OPACITY }}
            />
          )}

          <svg
            aria-label={ROOM_LABEL_CANVAS_COPY.canvasLabel}
            className="absolute inset-0 h-full w-full"
            role="img"
            viewBox={`${contentBounds.x} ${contentBounds.y} ${contentBounds.width} ${contentBounds.height}`}
          >
            {rooms.map((room) => (
              <RoomLabelCanvasRoomFigure
                isSelected={room.id === selectedRoomId}
                key={room.id}
                millimetresPerPixel={millimetresPerPixel}
                reducedMotion={reducedMotion}
                room={room}
              />
            ))}
          </svg>

          {activeBounds === null ? null : (
            <SelectionHalo
              hasEntered={halo.hasEntered}
              height={activeBounds.height}
              isVisible={halo.isVisible}
              variant={halo.variant}
              width={activeBounds.width}
              x={activeBounds.x - contentBounds.x}
              y={activeBounds.y - contentBounds.y}
            />
          )}

          {/* Nút chọn thật — xem ghi chú "Hai lớp cho MỘT phòng" ở đầu file. */}
          {rooms.map((room) => {
            const bounds = computeRoomBoundsPx(room, millimetresPerPixel);
            const label = room.hasName ? room.name : room.codeLabel;

            return (
              <RoomLabelCanvasSelectButton
                bounds={bounds}
                contentOriginPx={contentBounds}
                isInteractive={isInteractive}
                isSelected={room.id === selectedRoomId}
                key={room.id}
                label={label}
                onHover={onHover}
                onSelect={onSelect}
                roomId={room.id}
              />
            );
          })}
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="absolute inset-x-0 top-1/2 text-center text-[13px] text-text-muted">
          {ROOM_LABEL_CANVAS_COPY.emptyCanvas}
        </p>
      ) : null}

      {isInteractive ? null : (
        <p className="sr-only" id={FORBIDDEN_DESCRIPTION_ID}>
          {ROOM_LABEL_CANVAS_COPY.forbiddenNotice}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Nút chọn vô hình — một phòng, một hộp bao.                                  */
/* -------------------------------------------------------------------------- */

interface RoomLabelCanvasSelectButtonProps {
  readonly roomId: RoomLabelRoomId;
  readonly label: string;
  readonly bounds: RoomLabelBoundsPx;
  readonly contentOriginPx: RoomLabelBoundsPx;
  readonly isSelected: boolean;
  readonly isInteractive: boolean;
  readonly onSelect: (roomId: RoomLabelRoomId | null) => void;
  readonly onHover: (roomId: RoomLabelRoomId | null) => void;
}

function RoomLabelCanvasSelectButton({
  roomId,
  label,
  bounds,
  contentOriginPx,
  isSelected,
  isInteractive,
  onSelect,
  onHover,
}: RoomLabelCanvasSelectButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={isSelected}
      className="absolute rounded-[4px] border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-default"
      disabled={!isInteractive}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(roomId)}
      onFocus={() => onHover(roomId)}
      onMouseEnter={() => onHover(roomId)}
      onMouseLeave={() => onHover(null)}
      style={{
        height: bounds.height,
        left: bounds.x - contentOriginPx.x,
        top: bounds.y - contentOriginPx.y,
        width: bounds.width,
      }}
      type="button"
    />
  );
}
