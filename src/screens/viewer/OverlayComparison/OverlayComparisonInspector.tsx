/**
 * Panel phải của màn Đối chiếu bản vẽ (demo Z/S-28): vùng đang chọn — độ lệch, vị trí, lớp cần
 * sửa — và nút chính "Sửa … ở lớp …" đi thẳng tới lớp duyệt. View thuần: mọi thứ vào bằng props.
 * Từ 1280 trở lên đứng cố định bên phải; hẹp hơn thì thành ngăn kéo đè lên canvas, chỉ hiện khi
 * đang chọn một vùng (canvas giữ ≥ 65 % bề ngang ở 1024).
 */
import { X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { getButtonStyles } from '@/components/ui/buttonVariants';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/lib/utils';

import type { OverlayStatus } from './overlayStatus';
import type { ConfirmationViewModel, OverlayFixTarget } from './types';

export interface OverlayComparisonInspectorProps {
  readonly status: OverlayStatus;
  readonly confirmation: ConfirmationViewModel;
  readonly fixTargetOf?: ((objectCode: string) => OverlayFixTarget | null) | undefined;
  readonly onSelectRegion: (id: string | null) => void;
  readonly onConfirmMatch: () => void;
}

const EMPTY_TEXT: Readonly<Record<OverlayStatus['kind'], string>> = {
  noModel: 'Tầng này chưa có mô hình để đối chiếu.',
  noDrawing: 'Tầng này chưa có ảnh bản vẽ gốc để đặt dưới mô hình.',
  unmeasured: 'Máy chưa đo được vùng lệch. So hai lớp bằng mắt; khớp thì bấm xác nhận ở góc trên phải.',
  deviating: 'Chọn một vùng trong danh sách hoặc trên bản vẽ để xem độ lệch và lớp cần sửa.',
  matched: 'Mọi vùng nằm trong dung sai. Soát lại bằng mắt rồi bấm xác nhận ở góc trên phải; hệ thống không tự đánh dấu khớp.',
};

export function OverlayComparisonInspector({
  status,
  confirmation,
  fixTargetOf,
  onSelectRegion,
  onConfirmMatch,
}: OverlayComparisonInspectorProps) {
  const row = status.selectedRow;
  const isOver = row?.statusCode === 'attention';
  const target = row === null || fixTargetOf === undefined ? null : fixTargetOf(row.affectedObjectCode);
  // Một nút chính mỗi màn: khi lệch và chưa xác nhận, nút sửa là việc chính; cổng chỉ có nút phụ.
  const fixIsPrimary = isOver && status.kind === 'deviating' && !confirmation.isConfirmed;

  return (
    <aside
      aria-label="Vùng đang chọn"
      className={cn(
        'flex min-h-0 w-[264px] shrink-0 flex-col overflow-y-auto border-l border-border-default bg-bg-surface',
        // Dưới 1280: ngăn kéo đè lên phải canvas, chỉ khi đang chọn vùng.
        'max-xl:absolute max-xl:inset-y-3 max-xl:right-3 max-xl:z-30 max-xl:rounded-xl max-xl:border-l-0 max-xl:shadow-float',
        row === null && 'max-xl:hidden',
      )}
    >
      {row === null ? (
        <div className="flex flex-col gap-2 px-4 py-4">
          <h2 className="text-heading text-text-primary">Chưa chọn vùng</h2>
          <p className="text-body-sm text-text-secondary">{EMPTY_TEXT[status.kind]}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 px-4 pb-3 pt-4">
            <h2 className="font-mono text-heading text-text-primary">{row.affectedObjectCode}</h2>
            <Badge variant={isOver ? 'attention' : 'neutral'}>{isOver ? 'Vượt dung sai' : 'Trong dung sai'}</Badge>
            <IconButton
              aria-label="Bỏ chọn vùng"
              className="ml-auto"
              icon={<X size={16} aria-hidden="true" />}
              onClick={() => onSelectRegion(null)}
              size="sm"
            />
          </div>

          <div className="mx-4 rounded-lg bg-bg-sunken px-4 py-3">
            <p className="text-caption font-medium uppercase tracking-[0.06em] text-text-muted">Độ lệch đo được</p>
            <p className="mt-1 font-mono text-[28px] font-semibold leading-tight tabular-nums text-text-primary">
              {row.deviationText}
            </p>
            <p className="mt-1 text-body-sm text-text-secondary">{`Dung sai ${status.toleranceText}.`}</p>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-4 text-body-sm">
            <dt className="text-text-secondary">Vị trí</dt>
            <dd className="text-right text-text-primary">{row.referenceLabel}</dd>
            {target !== null && (
              <>
                <dt className="text-text-secondary">Lớp cần sửa</dt>
                <dd className="text-right text-text-primary">{target.layerLabel}</dd>
              </>
            )}
          </dl>

          <div className="flex flex-col gap-2 border-t border-border-default px-4 py-4">
            {target === null ? (
              <p className="text-body-sm text-text-secondary">Chưa xác định được lớp chứa đối tượng này.</p>
            ) : (
              <Link
                className={getButtonStyles({ variant: fixIsPrimary ? 'primary' : 'secondary', className: 'w-full' })}
                to={target.href}
              >
                {`Sửa ${row.affectedObjectCode} ở lớp ${target.layerLabel}`}
              </Link>
            )}
            {isOver && <p className="text-body-sm text-text-secondary">Sửa xong quay lại đây, số đo và danh sách tự cập nhật.</p>}
            {/* Vẫn còn lệch mà người duyệt thấy chấp nhận được: xác nhận là việc của người (A5), nút nhẹ. */}
            {status.kind === 'deviating' && !confirmation.isConfirmed && confirmation.canConfirm && (
              <Button onClick={() => onConfirmMatch()} variant="ghost">
                {confirmation.buttonLabel}
              </Button>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
