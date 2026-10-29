import { cn } from '@/lib/utils';

/**
 * Số thứ tự của một dòng hàng đợi L23 (`queueNumbersOf`): vòng tròn cùng kiểu với ghim số trên bản vẽ
 * ở chế độ Tổng thể, để dòng "3" trong cột và ghim "3" trên bản vẽ là một mục.
 */
export function QcQueueNumber({ n, current = false }: { readonly n: number; readonly current?: boolean }) {
  return (
    <span
      aria-label={`Số ${n} trong hàng đợi`}
      className={cn(
        'grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] text-[11px] font-bold tabular-nums',
        current ? 'border-accent bg-accent text-white' : 'border-state-attention bg-state-attention-tint text-state-attention-text',
      )}
    >
      {n}
    </span>
  );
}
