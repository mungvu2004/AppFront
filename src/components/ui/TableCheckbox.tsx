// Ô chọn của `Table` (Table.CheckboxHead / Table.CheckboxCell), tách khỏi `Table.tsx` cho dưới trần 400 dòng.
import { Checkbox } from './Checkbox';

// ─── Table.CheckboxHead ───────────────────────────────────────────────────────
// Header checkbox: select every row / none

interface TableCheckboxHeadProps {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}

export function TableCheckboxHead({ checked, indeterminate, onChange }: TableCheckboxHeadProps) {
  return (
    <th className="h-10 w-10 px-3 align-middle bg-bg-sunken sticky left-0 z-20" aria-label="Chọn tất cả">
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={onChange}
        aria-label="Chọn tất cả"
      />
    </th>
  );
}
TableCheckboxHead.displayName = 'Table.CheckboxHead';

// ─── Table.CheckboxCell ───────────────────────────────────────────────────────

interface TableCheckboxCellProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  rowId: string;
  /** Nhãn đọc cho trình đọc màn hình, ví dụ "Chọn tường W-003". Bỏ trống thì "Chọn dòng <rowId>". */
  label?: string | undefined;
}

export function TableCheckboxCell({ checked, onChange, rowId, label }: TableCheckboxCellProps) {
  return (
    <td className="h-10 w-10 px-3 align-middle sticky left-0 z-10 bg-inherit">
      <Checkbox
        checked={checked}
        onChange={onChange}
        aria-label={label ?? `Chọn dòng ${rowId}`}
        onClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}
TableCheckboxCell.displayName = 'Table.CheckboxCell';
