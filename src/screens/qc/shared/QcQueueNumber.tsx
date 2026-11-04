import { cn } from '@/lib/utils';

/**
 * Số thứ tự của một dòng hàng đợi L23 (`queueNumbersOf`): cùng số với ghim trên bản vẽ ở chế độ Tổng thể,
 * để dòng "3" trong cột và ghim "3" trên bản vẽ là một mục. Số trơn cho danh sách đỡ nhiễu (trạng thái đã
 * nói ở đầu nhóm); chỉ dòng đang chọn mới có vòng đặc.
 * Chỉ để nhìn (`aria-hidden`): tên đọc của dòng vẫn bắt đầu bằng mã ("#W-001 …"); vị trí trong hàng đợi
 * trình đọc màn hình nghe ở thẻ hỏi ("Đoạn 1 trong 30 cần xem").
 */
export function QcQueueNumber({ n, current = false }: { readonly n: number; readonly current?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[12px] font-medium tabular-nums',
        current ? 'bg-accent text-white' : 'text-text-muted',
      )}
      data-queue-number={n}
    >
      {n}
    </span>
  );
}
