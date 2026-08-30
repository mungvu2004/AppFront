/**
 * Nút sao chép của màn S-11 — dùng ở ba chỗ: mã lỗi, nhật ký đang hiện, và
 * "chép toàn bộ nhật ký" khi đã thất bại quá số lần.
 *
 * **View không đếm giờ.** `label` đến từ hook đã ở đúng trạng thái đang cần hiện
 * ("Sao chép" hoặc "Đã sao chép"), và `isCopied` nói cho nút biết đổi biểu tượng
 * mà không phải so chuỗi nhãn với một hằng số. Không `setTimeout`, không state,
 * không hằng số thời lượng nào trong file này — ngưỡng của cái nháy đó sống
 * trong hook (xem `PipelineFailureCopyAction` ở `types.ts`).
 *
 * `ariaLabel` nói rõ chép CÁI GÌ ("Sao chép mã lỗi"), còn chữ nhìn thấy chỉ là
 * "Sao chép": chữ nhìn thấy nằm gọn trong tên trình đọc màn hình đọc lên, nên
 * người dùng lệnh thoại đọc thấy sao thì gọi được vậy.
 */

import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/Button';

import type { PipelineFailureCopyAction } from './types';

export interface PipelineFailureCopyButtonProps {
  readonly action: PipelineFailureCopyAction;
}

export function PipelineFailureCopyButton({ action }: PipelineFailureCopyButtonProps) {
  return (
    <Button
      aria-label={action.ariaLabel}
      iconBefore={
        action.isCopied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />
      }
      onClick={action.onCopy}
      size="sm"
      variant="ghost"
    >
      {action.label}
    </Button>
  );
}
