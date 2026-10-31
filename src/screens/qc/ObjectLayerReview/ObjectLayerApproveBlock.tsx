import { Button } from '@/components/ui/Button';

/** Nút duyệt ở ĐẦU thẻ, ngoài vùng cuộn: chỗ không đổi theo loại đồ, không phải cuộn mới thấy (U12). */
export function ObjectLayerApproveBlock({
  label,
  hint,
  reviewed,
  shortcut,
  onApprove,
}: {
  readonly label: string;
  readonly hint: string;
  readonly reviewed: boolean;
  readonly shortcut: 'Enter' | 'A';
  readonly onApprove: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2 px-5 pb-4">
      <Button
        aria-keyshortcuts={shortcut}
        disabled={reviewed}
        fullWidth
        onClick={onApprove}
        {...(reviewed ? {} : { shortcut })}
        variant={reviewed ? 'secondary' : 'primary'}
      >
        {label}
      </Button>
      <p className="text-[12px] text-text-secondary">{hint}</p>
    </div>
  );
}
