/**
 * Dải khoá của thanh tra — tách khỏi `CollaborationLayer.tsx` vì trần R-22.
 *
 * Tệp gốc chạm 409 dòng có nội dung trên trần 400, và mục D nói rõ cách xử:
 * phần con ra tệp anh em trong cùng thư mục, đường nhập của nơi gọi không đổi.
 * `CommentThread.tsx` và `ConflictPanel.tsx` đã đứng ở đây theo đúng khuôn ấy.
 *
 * Ba hằng chuỗi và `holdingSentence` đi theo dải này vì không ai khác dùng chúng.
 */

import { Lock } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import { PRESENCE_ICON_STROKE, PRESENCE_LOCK_ICON_SIZE_PX } from './presenceHatch';
import type { LockVm } from './types';

const LOCK_SECTION_LABEL = 'Đối tượng đang bị người khác giữ';
const LOCK_HOLDER_FIELD_LABEL = 'Người đang giữ';
const REQUEST_ACCESS_LABEL = 'Yêu cầu quyền chỉnh sửa';

/** Một câu nói ai đang giữ và từ lúc nào. Hai chuỗi đã định dạng ở viewmodel. */
const holdingSentence = (lock: LockVm): string =>
  `${lock.holderName} đang giữ, từ ${lock.heldSinceLabel}`;

export interface LockStripProps {
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
export function LockStrip({ locks, canRequestAccess, onRequestEditAccess }: LockStripProps) {
  return (
    <section
      aria-label={LOCK_SECTION_LABEL}
      className="pointer-events-auto flex w-full flex-col gap-3 rounded-md bg-bg-surface p-3 shadow-panel"
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

