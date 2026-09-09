/**
 * Phần hiện diện nằm TRÊN canvas: con trỏ người khác, viền vùng chọn của họ, và
 * dấu khoá gạch chéo trên đối tượng người khác đang sửa.
 *
 * VIEW THUẦN (R-60): mọi thứ tới qua {@link PresenceOverlayProps}; không
 * `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`, không state
 * nội bộ nào. Lớp này không tự suy trạng thái — nó vẽ đúng những gì props nói.
 *
 * ## Neo toạ độ: vì sao khoá bám theo con trỏ của người giữ
 *
 * Hợp đồng `types.ts` cho toạ độ ở ĐÚNG MỘT chỗ: `CollaboratorVm.cursor`.
 * `LockVm` chỉ có `objectId`, `holderName`, `heldSinceLabel` — không hộp bao,
 * không tâm, không hình. `CollaboratorVm.selectionLabel` cũng là NHÃN chứ không
 * phải hình.
 *
 * Nên lớp này neo mọi thứ vào chỗ duy nhất có toạ độ thật: con trỏ. Dấu khoá
 * của một `LockVm` hiện cạnh con trỏ của **người đang giữ nó**, ghép bằng
 * `holderName` ↔ `CollaboratorVm.name`. Đó là dữ liệu có thật, không phải toạ độ
 * bịa: đối tượng ai đó đang sửa nằm dưới con trỏ của chính họ.
 *
 * Khoá mà người giữ không có mặt trên tầng này (hoặc chưa có toạ độ con trỏ) thì
 * KHÔNG bị bỏ rơi: `CollaborationLayer.tsx` liệt kê nó ở dải thanh tra, nơi
 * không cần toạ độ. "Khoá phải nhìn thấy trước khi tương tác" giữ được ở cả hai
 * đường, và không đường nào phải đoán một con số.
 *
 * ## Trạng thái 7 (thu gọn) tắt con trỏ nhưng KHÔNG tắt khoá
 *
 * Thu gọn là chuyện bớt nhiễu thị giác — con trỏ người khác là nhiễu, khoá thì
 * không: nó là điều kiện để người dùng biết mình có sửa được hay không. Ghim
 * bình luận cũng ở lại, và phần đó do `CollaborationLayer.tsx` giữ.
 */

import { Lock, MousePointer2 } from 'lucide-react';

import { motion } from '@/components/motion';
import { Tooltip } from '@/components/ui/Tooltip';
import { MOTION_EASINGS, durationSeconds } from '@/lib/motion';
import { Z_INDEX } from '@/lib/zIndex';

import {
  PRESENCE_CURSOR_SIZE_PX,
  PRESENCE_CURSOR_TOKEN,
  PRESENCE_HATCH_LINE_WIDTH_PX,
  PRESENCE_HATCH_OPACITY,
  PRESENCE_HATCH_PATTERN_ID,
  PRESENCE_HATCH_PATTERN_TRANSFORM,
  PRESENCE_HATCH_TILE_PX,
  PRESENCE_HATCH_TOKEN,
  PRESENCE_ICON_STROKE,
  PRESENCE_LOCK_ICON_SIZE_PX,
} from './presenceHatch';
import type { CollaborationCapabilities, CollaboratorVm, LockVm } from './types';

/* -------------------------------------------------------------------------- */
/* Chữ tĩnh và đường cong.                                                     */
/* -------------------------------------------------------------------------- */

/** Câu của tooltip dấu khoá. Nhận tên đã có, không tự ghép định dạng nào (A15). */
const editingByLabel = (holderName: string): string => `${holderName} đang chỉnh sửa`;

const SELECTING_PREFIX = 'đang chọn';

/*
 * Bốn điểm điều khiển lấy từ token, không viết tay. `MOTION_EASINGS.*.points`
 * là tuple chỉ-đọc còn framer-motion đòi tuple ghi được, nên nó được rải ra rồi
 * ghép lại một lần ở đây — cùng khuôn `useAccountTables.ts:205`.
 *
 * `inOut` cho việc DI CHUYỂN TẠI CHỖ (con trỏ trôi), `enter` cho thứ ĐANG TỚI
 * (con trỏ vừa xuất hiện). Không đường cong thứ ba ở file này.
 */
const [GLIDE_X1, GLIDE_Y1, GLIDE_X2, GLIDE_Y2] = MOTION_EASINGS.inOut.points;
const GLIDE_EASE: [number, number, number, number] = [GLIDE_X1, GLIDE_Y1, GLIDE_X2, GLIDE_Y2];

const [ENTER_X1, ENTER_Y1, ENTER_X2, ENTER_Y2] = MOTION_EASINGS.enter.points;
const ENTER_EASE: [number, number, number, number] = [ENTER_X1, ENTER_Y1, ENTER_X2, ENTER_Y2];

/* -------------------------------------------------------------------------- */
/* Mẫu gạch chéo — khai một lần cho cả lớp phủ.                                 */
/* -------------------------------------------------------------------------- */

/**
 * `<defs>` của mẫu lát, dựng đúng một lần rồi mọi dấu khoá trỏ vào bằng
 * `url(#…)`. Một `<svg>` rộng 0 cao 0, `aria-hidden`, không chiếm chỗ bố cục.
 */
function LockHatchDefs() {
  return (
    <svg aria-hidden="true" className="absolute h-0 w-0 overflow-hidden" focusable="false">
      <defs>
        <pattern
          id={PRESENCE_HATCH_PATTERN_ID}
          width={PRESENCE_HATCH_TILE_PX}
          height={PRESENCE_HATCH_TILE_PX}
          patternUnits="userSpaceOnUse"
          patternTransform={PRESENCE_HATCH_PATTERN_TRANSFORM}
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={PRESENCE_HATCH_TILE_PX}
            stroke={PRESENCE_HATCH_TOKEN}
            strokeWidth={PRESENCE_HATCH_LINE_WIDTH_PX}
          />
        </pattern>
      </defs>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Dấu khoá: gạch chéo 6% + biểu tượng khoá nhỏ + tooltip.                      */
/* -------------------------------------------------------------------------- */

interface LockMarkProps {
  readonly lock: LockVm;
}

/**
 * Gạch chéo phủ kín ô dấu, biểu tượng khoá đè lên, tooltip nói ai đang sửa.
 *
 * Độ mờ 6% nằm trên thuộc tính `opacity` của chính `<svg>` gạch chéo — không
 * phải class Tailwind, vì hậu tố alpha của repo này biên dịch ra rỗng (lý do đo
 * thật viết ở đầu `presenceHatch.ts`). Biểu tượng khoá KHÔNG mờ theo: 6% là độ
 * mờ của nền gạch, còn dấu khoá phải đọc được ngay.
 */
function LockMark({ lock }: LockMarkProps) {
  return (
    <Tooltip label={editingByLabel(lock.holderName)}>
      <span className="pointer-events-auto relative inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-md bg-bg-surface ring-1 ring-text-muted">
        <svg
          aria-hidden="true"
          focusable="false"
          className="absolute inset-0 h-full w-full"
          opacity={PRESENCE_HATCH_OPACITY}
        >
          <rect width="100%" height="100%" fill={`url(#${PRESENCE_HATCH_PATTERN_ID})`} />
        </svg>
        <Lock
          aria-hidden="true"
          className="relative text-text-secondary"
          size={PRESENCE_LOCK_ICON_SIZE_PX}
          strokeWidth={PRESENCE_ICON_STROKE}
        />
      </span>
    </Tooltip>
  );
}

/* -------------------------------------------------------------------------- */
/* Một con trỏ.                                                                */
/* -------------------------------------------------------------------------- */

interface CollaboratorCursorProps {
  readonly collaborator: CollaboratorVm;
  /** Toạ độ đã tách khỏi `collaborator.cursor` ở nơi gọi, nên chắc chắn có. */
  readonly cursor: { readonly x: number; readonly y: number };
  /** Khoá người này đang giữ; `null` khi họ không giữ gì hoặc năng lực đang tắt. */
  readonly lock: LockVm | null;
  /** Trạng thái 7 tắt cờ này: mũi con trỏ, tên và chip vùng chọn biến mất. */
  readonly showCursor: boolean;
}

/**
 * Mũi con trỏ + tên, cộng chip vùng chọn viền nét đứt và dấu khoá nếu có.
 *
 * Hai toạ độ đi vào `animate` chứ không vào `style`, nên framer-motion NỘI SUY
 * giữa hai vị trí: con trỏ **trôi** 120ms thay vì nhảy cóc. Độ mờ vào theo
 * `standard` (260ms) với đường cong `enter` — cùng thang với ảnh đại diện, để
 * một người vừa vào không bật ra đột ngột ở bất kỳ lớp nào.
 */
function CollaboratorCursor({
  collaborator,
  cursor,
  lock,
  showCursor,
}: CollaboratorCursorProps) {
  return (
    <motion.div
      className="absolute left-0 top-0 flex items-start gap-1"
      initial={{ opacity: 0, x: cursor.x, y: cursor.y }}
      animate={{ opacity: 1, x: cursor.x, y: cursor.y }}
      transition={{
        x: { duration: durationSeconds('instant'), ease: GLIDE_EASE },
        y: { duration: durationSeconds('instant'), ease: GLIDE_EASE },
        opacity: { duration: durationSeconds('standard'), ease: ENTER_EASE },
      }}
    >
      {/*
        Mũi con trỏ, tên và chip vùng chọn ẩn với trình đọc màn hình: chúng đổi
        vài chục lần mỗi giây và cùng một thông tin đã có ở danh sách hiện diện
        của thanh trên, nơi bàn phím tới được. Đặc tả cấm lời nhắc nói khi có
        người vào, nên vùng này không được là `aria-live`.
      */}
      {showCursor && (
      <span aria-hidden="true" className="flex items-start gap-1">
        <MousePointer2
          className="shrink-0"
          color={PRESENCE_CURSOR_TOKEN}
          size={PRESENCE_CURSOR_SIZE_PX}
          strokeWidth={PRESENCE_ICON_STROKE}
        />
        <span className="flex flex-col items-start gap-1">
          <span className="rounded bg-bg-surface px-1 text-[11px] leading-tight text-text-secondary shadow-rest">
            {collaborator.name}
          </span>
          {collaborator.selectionLabel !== null && (
            <span className="rounded border border-dashed border-text-muted px-1 text-[11px] leading-tight text-text-muted">
              {`${SELECTING_PREFIX} ${collaborator.selectionLabel}`}
            </span>
          )}
        </span>
      </span>
      )}
      {lock !== null && <LockMark lock={lock} />}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Lớp phủ.                                                                    */
/* -------------------------------------------------------------------------- */

export interface PresenceOverlayProps {
  readonly capabilities: CollaborationCapabilities;
  readonly collaborators: readonly CollaboratorVm[];
  readonly locks: readonly LockVm[];
  /** Trạng thái 7: con trỏ người khác biến mất; dấu khoá thì ở lại. */
  readonly isCollapsed: boolean;
}

/**
 * Lớp phủ hiện diện trên canvas.
 *
 * NĂNG LỰC TẮT THÌ BIẾN MẤT, KHÔNG PHẢI LÀM MỜ: `presence === false` thì không
 * một con trỏ, một tên hay một viền vùng chọn nào rời khỏi hàm này —
 * `others` không được duyệt. `locks === false` thì không `<pattern>` gạch chéo
 * nào được khai và không dấu khoá nào được dựng. Không `disabled`, không
 * `hidden`, không tooltip "sắp có".
 */
export function PresenceOverlay({
  capabilities,
  collaborators,
  locks,
  isCollapsed,
}: PresenceOverlayProps) {
  const showLocks = capabilities.locks;

  const lockOfHolder = (name: string): LockVm | null =>
    showLocks ? (locks.find((lock) => lock.holderName === name) ?? null) : null;

  /*
   * Toạ độ chỉ tồn tại khi `presence` bật, nên `presence === false` thì lớp này
   * không duyệt một người nào. Thu gọn thì KHÔNG tắt vòng lặp: nó chỉ tắt phần
   * con trỏ, còn dấu khoá ở lại vì khoá phải nhìn thấy trước khi tương tác.
   */
  const others = capabilities.presence ? collaborators.filter((person) => !person.isSelf) : [];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: Z_INDEX.canvasOverlay }}
    >
      {showLocks && <LockHatchDefs />}
      {others.map((person) => {
        const lock = lockOfHolder(person.name);

        // Thu gọn mà người này không giữ gì thì không còn gì để vẽ ở đây.
        if (person.cursor === null || (isCollapsed && lock === null)) {
          return null;
        }

        return (
          <CollaboratorCursor
            key={person.id}
            collaborator={person}
            cursor={person.cursor}
            lock={lock}
            showCursor={!isCollapsed}
          />
        );
      })}
    </div>
  );
}
