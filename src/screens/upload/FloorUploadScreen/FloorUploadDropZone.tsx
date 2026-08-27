/**
 * Vùng kéo thả của màn tải bản vẽ.
 *
 * ## Vùng này KHÔNG đổi kích thước khi kéo tệp qua
 *
 * Lời hứa đo được của đặc tả: lúc có tệp lơ lửng bên trên, vùng thả đổi **màu
 * viền và nền**, không đổi gì khác. Vì vậy mọi lớp ảnh hưởng hộp — chiều cao,
 * đệm, độ dày viền, `transform` — nằm trong phần dùng chung ở
 * {@link ZONE_BOX_CLASSES} và không bao giờ xuất hiện trong nhánh điều kiện.
 * Nhánh điều kiện chỉ được chứa màu. `FloorUploadScreen.test.tsx` so hai tập lớp
 * trước và sau `dragenter` rồi ném lỗi nếu có lớp nào của nhóm kích thước bị
 * thêm hay bớt.
 *
 * ## Không có con số dung lượng nào ở đây
 *
 * Dòng định dạng và trần dung lượng đến nguyên câu qua `dropZone.formatsLine`,
 * dựng từ hằng của `src/lib/upload`. Viết lại trần dung lượng thẳng vào màn là
 * tạo bản thứ hai của một giới hạn mà máy chủ mới là nơi quyết.
 */

import { useRef } from 'react';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/Button';

import { UploadGlyph } from './FloorUploadGlyphs';
import type { FloorUploadDropZoneModel } from './types';

/** Mã cho test bám vào; giữ nguyên qua mọi lượt đổi cách xếp. */
export const DROP_ZONE_TEST_ID = 'floor-upload-dropzone';

/** Mã của ô chọn tệp ẩn — test bắn `change` vào đúng nó. */
export const FILE_INPUT_TEST_ID = 'floor-upload-file-input';

/**
 * Mọi lớp quyết định hộp của vùng thả, gộp một chỗ.
 *
 * Danh sách này là bất biến "không đổi kích thước" viết thành mã: nó không phụ
 * thuộc `isDragActive`, nên không có nhánh nào đổi được nó.
 */
const ZONE_BOX_CLASSES =
  'flex h-[180px] w-full flex-col items-center justify-center gap-3 rounded-[16px] ' +
  'border-2 border-dashed px-6 text-center transition-colors duration-instant';

export interface FloorUploadDropZoneProps {
  readonly model: FloorUploadDropZoneModel;
  readonly isDragActive: boolean;
  readonly onFilesChosen: (files: readonly File[]) => void;
}

export function FloorUploadDropZone({ model, isDragActive, onFilesChosen }: FloorUploadDropZoneProps) {
  const inputId = 'floor-upload-file-input-control';
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div
      className={clsx(
        ZONE_BOX_CLASSES,
        isDragActive ? 'border-accent bg-accent-wash' : 'border-border-default bg-bg-surface',
      )}
      data-drag-active={isDragActive ? 'true' : 'false'}
      data-testid={DROP_ZONE_TEST_ID}
    >
      <UploadGlyph />

      <p className="text-[15px] font-medium text-text-primary">{model.title}</p>

      <label className="sr-only" htmlFor={inputId}>
        {model.selectFileLabel}
      </label>
      <input
        accept={model.acceptAttribute}
        className="sr-only"
        data-testid={FILE_INPUT_TEST_ID}
        id={inputId}
        ref={inputRef}
        multiple
        onChange={(event) => {
          const chosen = event.target.files;

          if (chosen !== null && chosen.length > 0) {
            onFilesChosen([...chosen]);
          }

          // Chọn lại đúng tệp vừa chọn phải bắn `change` một lần nữa; không xoá
          // giá trị thì trình duyệt coi là "không có gì đổi" và im lặng.
          event.target.value = '';
        }}
        type="file"
      />
      <Button
        onClick={() => inputRef.current?.click()}
        size="sm"
        type="button"
        variant="secondary"
      >
        {model.selectFileLabel}
      </Button>

      <p className="text-[13px] text-text-muted">{model.formatsLine}</p>
    </div>
  );
}
