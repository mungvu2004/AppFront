/**
 * Bảng đỉnh — mã đỉnh + x + y, chữ đều, sửa ngay trong ô.
 *
 * `Table.Row` bị liệt vào DANH SÁCH ĐỎ (`notes/wall-geometry-editor/contract-ui.md`
 * mục F.1): vòng focus của nó điều khiển bằng state React (`focused &&
 * 'ring-2…'`) chứ không phải `:focus-visible`, nên nó không qua nổi
 * `expectAccessible`. Ở đây dùng `<tr>` thường cho khung hàng, và việc CHỌN một
 * hàng đi qua một nút thật (mã đỉnh) có vòng focus tĩnh bằng CSS — bàn phím Tab
 * tới được, Enter chọn được (A12), và `expectAccessible` không có gì để bắt lỗi.
 *
 * Hai ô toạ độ dùng `Input` (không phải `NumericField`): `draftValue` là chuỗi
 * người dùng đang gõ nguyên văn, còn `NumericField` ép giá trị qua
 * `value?: number`, tức chính phép quy đổi mà `wallGeometryEditorTypes.ts`
 * viết hai trường `displayValue`/`draftValue` riêng để view khỏi phải tự làm
 * (`local/no-raw-number`).
 */
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

import type {
  WallGeometryVertexCell,
  WallGeometryVertexRow,
  WallGeometryVertexTable as WallGeometryVertexTableModel,
} from './wallGeometryEditorTypes';

const CODE_BUTTON_CLASS =
  'rounded-[4px] px-1 font-mono text-[13px] text-text-primary outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-surface';

function VertexCellField({
  cell,
  ariaLabel,
  isLocked,
}: {
  cell: WallGeometryVertexCell;
  ariaLabel: string;
  isLocked: boolean;
}): ReactNode {
  const value = cell.status === 'idle' ? cell.displayValue : cell.draftValue;

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    cell.onDraftChange(event.target.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      cell.onCommit();
    } else if (event.key === 'Escape') {
      cell.onCancel();
    }
  };

  return (
    <Input
      aria-label={ariaLabel}
      className="font-mono text-[13px] text-right"
      error={cell.status === 'invalid' ? cell.message : undefined}
      isReadOnly={isLocked}
      onBlur={cell.onCommit}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      value={value}
      wrapperClassName="min-w-[92px]"
    />
  );
}

export interface WallGeometryVertexTableProps {
  readonly table: WallGeometryVertexTableModel;
}

export function WallGeometryVertexTable({ table }: WallGeometryVertexTableProps): ReactNode {
  return (
    <section
      aria-label={table.columns.code}
      className="pointer-events-auto flex w-[280px] flex-col overflow-hidden rounded-xl bg-bg-surface shadow-panel"
    >
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border-default">
            <th className="h-9 px-3 font-medium text-text-secondary" scope="col">
              {table.columns.code}
            </th>
            <th className="h-9 px-3 font-medium text-text-secondary" scope="col">
              {table.columns.x}
            </th>
            <th className="h-9 px-3 font-medium text-text-secondary" scope="col">
              {table.columns.y}
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-text-secondary" colSpan={3}>
                {table.emptyMessage}
              </td>
            </tr>
          ) : (
            table.rows.map((row: WallGeometryVertexRow) => (
              <tr
                className={cn('border-b border-border-default/50 last:border-0', row.isSelected && 'bg-bg-selected')}
                key={row.id}
              >
                <td className="h-11 px-3 align-middle">
                  <button className={CODE_BUTTON_CLASS} onClick={row.onSelect} type="button">
                    {row.code}
                  </button>
                </td>
                <td className="h-11 px-2 align-middle">
                  <VertexCellField ariaLabel={`${table.columns.x} ${row.code}`} cell={row.x} isLocked={row.isLocked} />
                </td>
                <td className="h-11 px-2 align-middle">
                  <VertexCellField ariaLabel={`${table.columns.y} ${row.code}`} cell={row.y} isLocked={row.isLocked} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
