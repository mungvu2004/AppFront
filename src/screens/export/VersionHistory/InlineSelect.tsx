/**
 * Ô chọn gọn cho đầu khung / vùng `next` của `PageHead` (bản Z S-37): nhãn ngắn đứng trong
 * cùng hàng với ô ("Gốc", "Đối chiếu", "Tầng"), không có nhãn rời phía trên làm cao đầu khung.
 * Tên đầy đủ vẫn là `<label>` thật (ẩn mắt) nên trình đọc màn hình và test tìm ô theo tên.
 */

import { Select } from '@/components/ui/Select';

export interface InlineSelectProps {
  /** Tên đầy đủ cho trình đọc màn hình ("Phiên bản gốc"). */
  readonly label: string;
  /** Chữ ngắn hiện trước ô ("Gốc"). */
  readonly prefix: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly value: string | null;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}

export function InlineSelect({ label, prefix, options, value, onChange, placeholder }: InlineSelectProps) {
  const list = [...options];

  return (
    <Select.Root value={value ?? undefined} onChange={onChange} options={list} className="flex-row items-center gap-2">
      <Select.Label className="sr-only">{label}</Select.Label>
      <span aria-hidden="true" className="shrink-0 whitespace-nowrap text-[13px] text-text-secondary">
        {prefix}
      </span>
      <Select.Trigger options={list} {...(placeholder === undefined ? {} : { placeholder })} className="min-w-[150px]" />
      <Select.Content>
        {list.length === 0 ? (
          <Select.Empty />
        ) : (
          list.map((option, index) => (
            <Select.Item key={option.value} value={option.value} index={index}>
              {option.label}
            </Select.Item>
          ))
        )}
      </Select.Content>
    </Select.Root>
  );
}
