/**
 * Ô nhập TÊN PHÒNG của thanh tra — chữ tự do là nguồn sự thật, vựng chuẩn chỉ
 * là gợi ý.
 *
 * ## Vì sao KHÔNG dùng `Combobox` (quyết định Q5 của điều phối viên)
 *
 * `src/components/ui/Combobox/**` là một select CÓ TÌM KIẾM: `onChange` chỉ
 * được gọi từ `selectOption(...)`, và chuỗi người dùng gõ (`query`) bị reset
 * về `''` ngay khi chọn xong — không có đường nào để một cái tên NGOÀI danh
 * sách đi ra ngoài. Mà "gợi ý nhưng không bao giờ ép" là điều khoản CẤM
 * TUYỆT ĐỐI của đặc tả, và sửa `src/components/**` thì R-68 cấm. Nên ô này
 * dựng bằng `Input` (chữ tự do) + một hàng gợi ý bấm được, ghép từ nguyên
 * thuỷ đã có, nằm TRONG thư mục màn. Lệch so với chữ "Combobox" của đặc tả
 * gốc là có chủ ý và đã được duyệt.
 *
 * ## "Không bao giờ ép" nghĩa là gì ở đây, cụ thể
 *
 * - Chữ gõ vào KHÔNG bị chặn, KHÔNG bị tự sửa, KHÔNG bị so với danh sách gợi
 *   ý; ô nhập không bao giờ nhận một `error` nào vì tên nằm ngoài vựng chuẩn.
 * - Bấm/chọn một gợi ý chỉ ĐIỀN vào ô rồi trả tiêu điểm về ô — người dùng sửa
 *   tiếp được ngay, và chỉ khi rời ô hoặc nhấn Enter thì tên mới được cam kết.
 * - Esc trả ô về đúng tên đang lưu, không cam kết gì.
 *
 * Danh sách gợi ý tới BẰNG PROPS (hook đọc `ROOM_USAGE_LABELS` của tầng
 * luật) — màn không định nghĩa lại một danh mục công năng nào.
 */

import { useRef, useState } from 'react';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

const NAME_LABEL = 'Tên phòng';
const NAME_PLACEHOLDER = 'Gõ tên phòng';
const NAME_HINT = 'Gợi ý bên dưới chỉ để chọn nhanh — tên tự gõ luôn được giữ nguyên.';
const SUGGESTIONS_ARIA_LABEL = 'Gợi ý tên phòng';

export interface RoomLabelNameFieldProps {
  /** Tên đang lưu của phòng — nguồn sự thật khi người dùng huỷ bằng Esc. */
  readonly name: string;
  /** Vựng chuẩn để gợi ý, đến từ props (`ROOM_USAGE_LABELS`). */
  readonly suggestions: readonly string[];
  /** Chỉ gọi khi rời ô hoặc nhấn Enter, và chỉ khi tên thật sự đổi. */
  readonly onCommit: (name: string) => void;
  /** Vai Người xem: hiện tên như chữ thường, không có ô nhập nào. */
  readonly isReadOnly: boolean;
}

export function RoomLabelNameField({ name, suggestions, onCommit, isReadOnly }: RoomLabelNameFieldProps) {
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const commit = () => {
    if (draft === name) {
      return;
    }

    onCommit(draft);
  };

  if (isReadOnly) {
    return <Input isReadOnly label={NAME_LABEL} value={name} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        hint={NAME_HINT}
        label={NAME_LABEL}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();

            return;
          }

          if (event.key === 'Escape') {
            setDraft(name);
          }
        }}
        placeholder={NAME_PLACEHOLDER}
        ref={inputRef}
        value={draft}
      />

      <div aria-label={SUGGESTIONS_ARIA_LABEL} className="flex flex-wrap gap-1.5" role="group">
        {suggestions.map((suggestion) => (
          <button
            className={cn(
              'rounded-full border border-border-default px-2.5 py-1 text-[12px] text-text-secondary',
              'transition-colors duration-120 outline-none hover:bg-bg-hover hover:text-text-primary',
              'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
              suggestion === draft && 'border-accent bg-accent-wash text-accent',
            )}
            key={suggestion}
            /*
             * Điền vào ô, KHÔNG cam kết: người dùng còn sửa tiếp được. Cam kết
             * vẫn đi qua đúng một cửa (rời ô hoặc Enter) như khi tự gõ.
             */
            onClick={() => {
              setDraft(suggestion);
              inputRef.current?.focus();
            }}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
