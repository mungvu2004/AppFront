/**
 * Lớp phủ cộng tác — view gốc: nhóm hiện diện ở thanh trên, danh sách ai đang ở
 * đâu, dải khoá của thanh tra, và hai khe cho hai phần do lớp khác dựng.
 *
 * VIEW THUẦN (R-60): mọi thứ tới qua `CollaborationLayerProps` của `./types` —
 * không `@/api`, không `@/store`, không `@/domain`, không `@/lib/http`. `useState`
 * duy nhất ở đây mở/đóng danh sách hiện diện, tức là một trạng thái TRÌNH BÀY;
 * bảy trạng thái A11 đọc thẳng từ `syncState`, `canWrite`, `isCollapsed` và
 * `collaborators`, không có `isLoading` hay `error` nào tự viết.
 *
 * ## Bảy trạng thái, đọc từ props chứ không suy
 *
 * 1 `collaborators` chỉ có `isSelf` → "chỉ mình bạn đang xem" · 2 `'dang-noi'` →
 * caption nhẹ, **không vòng xoay** · 3 `'dong-bo-cham'` / `'lam-viec-rieng'` →
 * caption, và vẫn sửa được · 4 `'mat-ket-noi'` → caption thường trực nói thay
 * đổi sẽ đồng bộ khi có mạng lại · 5 `'da-noi'` → không caption đồng bộ nào ·
 * 6 `canWrite === false` → caption chỉ xem, không ô nào ghi được · 7
 * `isCollapsed === true` → nhóm ảnh thành chip đếm, con trỏ người khác ẩn, ghim
 * bình luận Ở LẠI.
 *
 * Không nhánh nào là màn trắng: dải khoá, caption và chip đếm đều dựng từ props
 * đã có, nên trạng thái nào cũng còn thứ để đọc.
 *
 * ## Năng lực tắt thì BIẾN MẤT, không phải làm mờ
 *
 * `presence === false` → không con trỏ, không viền vùng chọn, và mục "đi đến vị
 * trí của họ" rời khỏi DOM (không toạ độ thì không có chỗ để đi tới).
 * `locks === false` → không gạch chéo, không biểu tượng khoá, không dải khoá.
 * `comments === false` → không dựng `CommentThread`. `requestAccess === false` →
 * nút "yêu cầu quyền chỉnh sửa" rời khỏi DOM. Không `disabled`, không ẩn bằng
 * CSS, không tooltip "sắp có".
 *
 * ## Chỗ lệch giữa đặc tả và thang của repo, và bên nào thắng
 *
 * Ảnh đại diện đặc tả xin 24px; `Avatar` chỉ có 28 và 64, và thêm cỡ thứ ba là
 * sửa `src/components/**` — dùng 28. Ảnh vào xin 240ms, nhảy hàng xin 400ms;
 * thang chỉ có 120/180/260/340/700 nên vào là `standard` (260), biến mất là
 * `fast` (180) với đường cong `exit`. Nhóm ảnh xếp bằng tay chứ không dùng
 * `Avatar.Stack`: `Stack` tự dựng con của nó nên `AnimatePresence` không bám
 * được vào TỪNG ảnh, mà "vào bằng phóng từ 0,9, biến mất bằng mờ dần" là yêu
 * cầu ở từng ảnh — từng khuôn mặt vẫn là `Avatar` dùng chung, chỉ phần xếp đè và
 * chip "+N" nằm ở đây. `AvatarProps.presence` KHÔNG được bật: nó vẽ
 * `ring-accent`, mà A2 dành màu nhấn cho thứ tương tác được.
 */

import { useState } from 'react';
import { Lock, Users } from 'lucide-react';

import { AnimatePresence, motion } from '@/components/motion';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useShortcut } from '@/hooks/useShortcut';
import { MOTION_EASINGS, durationSeconds } from '@/lib/motion';
import { Z_INDEX } from '@/lib/zIndex';

/*
 * Hai phần do lớp khác dựng; chữ ký do điều phối viên CHỐT, không do file này
 * đoán: `CommentThreadProps { comments, isCollapsed, onFrameComment }` và
 * `ConflictPanelProps { conflict, onResolveConflict, onDeferConflict }`. Cả hai
 * KHÔNG nhận `canWrite` — mọi điều khiển GHI của bình luận đã bị cắt khỏi DOM vì
 * không có tầng logic nào đỡ chúng, còn một xung đột thì luôn đòi một lựa chọn
 * của con người dù người đó có quyền ghi hay không.
 */
import { CommentThread } from './CommentThread';
import { ConflictPanel } from './ConflictPanel';
import { PresenceOverlay } from './PresenceOverlay';
import { PRESENCE_ICON_STROKE, PRESENCE_LOCK_ICON_SIZE_PX } from './presenceHatch';
import type { CollaborationLayerProps, CollaborationSyncState, CollaboratorVm, LockVm } from './types';

/* -------------------------------------------------------------------------- */
/* Chữ tĩnh — bản dịch cố định của giao diện, viết thường kiểu câu (A6).        */
/* -------------------------------------------------------------------------- */

const ROSTER_TOGGLE_LABEL = 'Ai đang xem';
const ROSTER_LIST_LABEL = 'Những người đang xem';
const GO_TO_LABEL = 'Đi đến vị trí của họ';
const SELF_SUFFIX = 'bạn';
const SELECTING_PREFIX = 'đang chọn';
const NOTHING_SELECTED_LABEL = 'chưa chọn gì';
const ALONE_CAPTION = 'chỉ mình bạn đang xem';
const READ_ONLY_CAPTION = 'bạn đang xem, không sửa được';
const LOCK_SECTION_LABEL = 'Đối tượng đang bị người khác giữ';
const LOCK_HOLDER_FIELD_LABEL = 'Người đang giữ';
const REQUEST_ACCESS_LABEL = 'Yêu cầu quyền chỉnh sửa';

/** Caption của bốn trạng thái kênh không phải `'da-noi'`. */
const SYNC_CAPTIONS: Readonly<Record<CollaborationSyncState, string | null>> = {
  'dang-noi': 'đang nối phiên cộng tác',
  'da-noi': null,
  'dong-bo-cham': 'đang đồng bộ chậm',
  'lam-viec-rieng': 'đang làm việc riêng',
  'mat-ket-noi': 'mất kết nối — thay đổi sẽ đồng bộ khi có mạng lại',
};

/** Số ảnh hiện tối đa trước khi phần dư gộp thành một chip "+N". */
const MAX_VISIBLE_AVATARS = 4;

/** Xếp đè: mỗi ảnh sau lùi vào ảnh trước, đúng khoảng của `Avatar.Stack`. */
const AVATAR_OVERLAP = '-8px';

const [ENTER_X1, ENTER_Y1, ENTER_X2, ENTER_Y2] = MOTION_EASINGS.enter.points;
const ENTER_EASE: [number, number, number, number] = [ENTER_X1, ENTER_Y1, ENTER_X2, ENTER_Y2];

const [EXIT_X1, EXIT_Y1, EXIT_X2, EXIT_Y2] = MOTION_EASINGS.exit.points;
const EXIT_EASE: [number, number, number, number] = [EXIT_X1, EXIT_Y1, EXIT_X2, EXIT_Y2];

/** Ảnh vào: phóng từ 0,9 chứ không bật ra từ 0. */
const AVATAR_ENTER_SCALE = 0.9;

/** Một câu nói ai đang giữ và từ lúc nào. Hai chuỗi đã định dạng ở viewmodel. */
const holdingSentence = (lock: LockVm): string =>
  `${lock.holderName} đang giữ, từ ${lock.heldSinceLabel}`;

/** Dòng phụ của một người: đang ở tầng nào, và đang chọn gì. */
const rosterDetail = (person: CollaboratorVm): string =>
  person.selectionLabel === null
    ? `${person.floorLabel} · ${NOTHING_SELECTED_LABEL}`
    : `${person.floorLabel} · ${SELECTING_PREFIX} ${person.selectionLabel}`;

/* -------------------------------------------------------------------------- */
/* Nhóm ảnh đại diện.                                                          */
/* -------------------------------------------------------------------------- */

interface PresenceAvatarsProps {
  readonly collaborators: readonly CollaboratorVm[];
}

/**
 * Bốn ảnh xếp đè, phần dư thành một chip "+N". `AnimatePresence` bọc TỪNG ảnh
 * nên một người vào thì đúng ảnh của người đó phóng từ 0,9 lên 1 trong 260ms,
 * một người rời thì đúng ảnh đó mờ dần trong 180ms theo đường cong `exit`:
 * không ảnh nào bật ra đột ngột, không lượt vào nào làm cả nhóm nhảy lại.
 */
function PresenceAvatars({ collaborators }: PresenceAvatarsProps) {
  const visible = collaborators.slice(0, MAX_VISIBLE_AVATARS);
  const overflow = collaborators.length - visible.length;

  return (
    <span className="flex items-center">
      <AnimatePresence initial={false}>
        {visible.map((person, index) => (
          <motion.span
            key={person.id}
            className="relative shrink-0 rounded-full ring-2 ring-bg-surface"
            style={{ marginLeft: index > 0 ? AVATAR_OVERLAP : undefined }}
            initial={{ opacity: 0, scale: AVATAR_ENTER_SCALE }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{
              opacity: 0,
              transition: { duration: durationSeconds('fast'), ease: EXIT_EASE },
            }}
            transition={{
              opacity: { duration: durationSeconds('standard'), ease: ENTER_EASE },
              scale: { duration: durationSeconds('standard'), ease: ENTER_EASE },
            }}
          >
            <Avatar initials={person.initials} alt={person.name} />
          </motion.span>
        ))}
      </AnimatePresence>
      {overflow > 0 && (
        <span
          className="relative flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full bg-bg-sunken text-[12px] font-medium text-text-secondary ring-2 ring-bg-surface"
          style={{ marginLeft: AVATAR_OVERLAP }}
        >
          {`+${overflow}`}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Danh sách hiện diện.                                                        */
/* -------------------------------------------------------------------------- */

interface PresenceRosterProps {
  readonly collaborators: readonly CollaboratorVm[];
  readonly canGoTo: boolean;
  readonly onGoToCollaborator: (collaboratorId: string) => void;
}

/** Ai đang ở tầng nào, đang chọn gì, và đường đi tới chỗ họ. */
function PresenceRoster({ collaborators, canGoTo, onGoToCollaborator }: PresenceRosterProps) {
  return (
    <motion.ul
      aria-label={ROSTER_LIST_LABEL}
      className="flex w-full flex-col gap-2 rounded-md bg-bg-surface p-2 shadow-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: durationSeconds('fast'), ease: EXIT_EASE } }}
      transition={{ duration: durationSeconds('fast'), ease: ENTER_EASE }}
    >
      {collaborators.map((person) => (
        <li key={person.id} className="flex items-center gap-2">
          <Avatar initials={person.initials} alt={person.name} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] text-text-primary">
              {person.isSelf ? `${person.name} (${SELF_SUFFIX})` : person.name}
            </span>
            <span className="truncate text-[11px] text-text-secondary">{rosterDetail(person)}</span>
          </span>
          {canGoTo && !person.isSelf && (
            <Button
              className="ml-auto shrink-0"
              variant="ghost"
              size="sm"
              onClick={() => onGoToCollaborator(person.id)}
            >
              {GO_TO_LABEL}
            </Button>
          )}
        </li>
      ))}
    </motion.ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Dải khoá của thanh tra.                                                     */
/* -------------------------------------------------------------------------- */

interface LockStripProps {
  readonly locks: readonly LockVm[];
  readonly canRequestAccess: boolean;
  readonly onRequestEditAccess: (objectId: string) => void;
}

/**
 * Đầu panel nói ai đang giữ và từ lúc nào; ô thanh tra ở dưới CHỈ ĐỌC.
 *
 * Hợp đồng không có `selectedObjectId`, nên dải này liệt kê MỌI khoá đang có chứ
 * không riêng đối tượng đang chọn — cách duy nhất dựng được từ props mà không tự
 * suy ra một vùng chọn không tồn tại. Nó cũng là đường BÀN PHÍM tới cùng thông
 * tin mà dấu khoá trên canvas chỉ nói bằng tooltip khi trỏ vào (A12). `Input` để
 * `isReadOnly` chứ không `disabled`: ô vẫn đọc và chép chữ được, chỉ không ghi.
 */
function LockStrip({ locks, canRequestAccess, onRequestEditAccess }: LockStripProps) {
  return (
    <section
      aria-label={LOCK_SECTION_LABEL}
      className="flex w-full flex-col gap-3 rounded-md bg-bg-surface p-3 shadow-panel"
    >
      {locks.map((lock) => (
        <div key={lock.objectId} className="flex flex-col gap-2">
          <p className="flex items-start gap-1.5 text-[13px] text-text-secondary">
            <Lock
              aria-hidden="true"
              className="mt-0.5 shrink-0"
              size={PRESENCE_LOCK_ICON_SIZE_PX}
              strokeWidth={PRESENCE_ICON_STROKE}
            />
            {holdingSentence(lock)}
          </p>
          <Input
            label={LOCK_HOLDER_FIELD_LABEL}
            value={lock.holderName}
            isReadOnly
            hint={lock.heldSinceLabel}
          />
          {canRequestAccess && (
            <Button
              className="self-start"
              variant="ghost"
              size="sm"
              onClick={() => onRequestEditAccess(lock.objectId)}
            >
              {REQUEST_ACCESS_LABEL}
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* View gốc.                                                                   */
/* -------------------------------------------------------------------------- */

export function CollaborationLayer({
  capabilities,
  syncState,
  collaborators,
  locks,
  conflict,
  comments,
  isCollapsed,
  canWrite,
  onGoToCollaborator,
  onRequestEditAccess,
  onResolveConflict,
  onDeferConflict,
  onFrameComment,
}: CollaborationLayerProps) {
  const [isRosterOpen, setRosterOpen] = useState(false);

  /*
   * Esc đóng lớp trên cùng (A12), qua sổ phím tắt chứ không qua một
   * `addEventListener` tự gắn. Tầng `'sidePanel'` chứ không `'dialog'`: danh sách
   * hiện diện không phải hộp thoại nên không được khoá phím công cụ của canvas
   * phía sau, và `enabled` tắt hẳn đăng ký khi nó đóng.
   */
  useShortcut(
    {
      id: 'collaborationLayer.roster.close',
      combo: 'Escape',
      scope: 'sidePanel',
      description: 'đóng danh sách người đang xem',
      onTrigger: () => setRosterOpen(false),
    },
    { enabled: isRosterOpen },
  );

  const others = collaborators.filter((person) => !person.isSelf);
  const captions = [
    SYNC_CAPTIONS[syncState],
    others.length === 0 ? ALONE_CAPTION : null,
    canWrite ? null : READ_ONLY_CAPTION,
  ].filter((caption): caption is string => caption !== null);

  const showLockStrip = capabilities.locks && locks.length > 0;

  return (
    <div className="pointer-events-none absolute inset-0">
      <PresenceOverlay
        capabilities={capabilities}
        collaborators={collaborators}
        locks={locks}
        isCollapsed={isCollapsed}
      />

      {/* Ghim bình luận: không năng lực thì KHÔNG dựng, chứ không dựng rồi tắt. */}
      {capabilities.comments && (
        <CommentThread
          comments={comments}
          isCollapsed={isCollapsed}
          onFrameComment={onFrameComment}
        />
      )}

      {/* Panel xung đột: `null` thì không dựng, và không bao giờ là hộp thoại. */}
      {conflict !== null && (
        <ConflictPanel
          conflict={conflict}
          onResolveConflict={onResolveConflict}
          onDeferConflict={onDeferConflict}
        />
      )}

      <div
        className="pointer-events-auto absolute right-4 top-4 flex w-[280px] flex-col items-end gap-2"
        style={{ zIndex: Z_INDEX.panel }}
      >
        <button
          type="button"
          aria-expanded={isRosterOpen}
          aria-label={ROSTER_TOGGLE_LABEL}
          className="flex items-center gap-2 rounded-full bg-bg-surface px-1 py-1 shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface"
          onClick={() => setRosterOpen((open) => !open)}
        >
          {isCollapsed ? (
            <Badge variant="neutral" noDot>
              <Users
                aria-hidden="true"
                className="mr-1"
                size={PRESENCE_LOCK_ICON_SIZE_PX}
                strokeWidth={PRESENCE_ICON_STROKE}
              />
              {`${collaborators.length} người`}
            </Badge>
          ) : (
            <PresenceAvatars collaborators={collaborators} />
          )}
        </button>

        {captions.length > 0 && (
          <div role="status" className="flex flex-col items-end gap-0.5 text-right">
            {captions.map((caption) => (
              <p key={caption} className="text-[11px] leading-tight text-text-secondary">
                {caption}
              </p>
            ))}
          </div>
        )}

        <AnimatePresence>
          {isRosterOpen && (
            <PresenceRoster
              collaborators={collaborators}
              canGoTo={capabilities.presence}
              onGoToCollaborator={onGoToCollaborator}
            />
          )}
        </AnimatePresence>

        {showLockStrip && (
          <LockStrip
            locks={locks}
            canRequestAccess={capabilities.requestAccess}
            onRequestEditAccess={onRequestEditAccess}
          />
        )}
      </div>
    </div>
  );
}
