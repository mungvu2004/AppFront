/**
 * Lối đi từ một dòng tầng sang các màn của tầng ấy: "Đối chiếu lớp phủ" và menu "Duyệt lớp".
 * Tách khỏi `FloorTableRow` để file ấy dưới trần 400 dòng. Chỉ vẽ khi tầng đã có bản vẽ.
 */
import type { MouseEvent } from 'react';

import { Button } from '@/components/ui/Button';

import type { FloorRowVm } from './floorManagerTypes';

const OVERLAY_ACTION_LABEL = 'Đối chiếu lớp phủ';
const REVIEW_MENU_LABEL = 'Duyệt lớp';

export interface FloorRowLinksProps {
  readonly row: FloorRowVm;
  readonly onOpenOverlay?: ((floorId: string) => void) | undefined;
  readonly onOpenReviewMenu?: ((event: MouseEvent, row: FloorRowVm) => void) | undefined;
}

export function FloorRowLinks({ row, onOpenOverlay, onOpenReviewMenu }: FloorRowLinksProps) {
  if (!row.hasDrawing) return null;

  return (
    <>
      {onOpenOverlay !== undefined && (
        <Button
          aria-label={`${OVERLAY_ACTION_LABEL} tầng ${row.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenOverlay(row.id);
          }}
          size="sm"
          variant="ghost"
        >
          {OVERLAY_ACTION_LABEL}
        </Button>
      )}
      {onOpenReviewMenu !== undefined && (
        <Button
          aria-haspopup="menu"
          aria-label={`${REVIEW_MENU_LABEL} tầng ${row.name}`}
          onClick={(event) => {
            event.stopPropagation();
            onOpenReviewMenu(event, row);
          }}
          size="sm"
          variant="ghost"
        >
          {REVIEW_MENU_LABEL} ▾
        </Button>
      )}
    </>
  );
}
