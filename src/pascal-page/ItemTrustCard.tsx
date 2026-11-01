/**
 * Nhãn tin cậy của trang 3D (D7): chọn đúng MỘT món đồ thì cụm chỉnh cảnh nói món đó đến từ đâu —
 * máy tự thêm, máy chưa chắc, hay người đã duyệt. Đọc `metadata` mà `toPascal.ts` chép sang
 * (`appfront.confidence/reviewed`, `generated`). Xanh "đã xác minh" chỉ cho việc người duyệt (A5).
 */
/* eslint-disable react-refresh/only-export-components -- hàm thuần đi kèm thẻ để test gọi thẳng. */
import { formatNumber } from '@/lib/format/number';
import { CONFIDENCE_SUGGESTED_THRESHOLD } from '@/lib/format/semantic';

import type { SwapModelStores } from './SwapModelCard';

interface LooseMetadata {
  readonly generated?: unknown;
  readonly appfront?: { readonly confidence?: unknown; readonly reviewed?: unknown };
}

interface LooseNode {
  readonly type: string;
  readonly metadata?: LooseMetadata;
}

export interface ItemTrustLabel {
  readonly text: string;
  readonly tone: 'verified' | 'attention' | 'neutral';
}

/** Nhãn của một món đồ; `null` khi không có gì cần nói (máy khá chắc, chưa duyệt). */
export function itemTrustLabelOf(metadata: LooseMetadata | undefined): ItemTrustLabel | null {
  if (metadata === undefined) return null;
  if (metadata.generated !== undefined) return { text: 'Máy tự thêm — không có trên bản vẽ', tone: 'neutral' };
  const origin = metadata.appfront;
  if (origin === undefined) return null;
  if (origin.reviewed === true) return { text: 'Bạn đã duyệt', tone: 'verified' };
  const confidence = origin.confidence;
  if (typeof confidence === 'number' && confidence < CONFIDENCE_SUGGESTED_THRESHOLD) {
    return { text: `Máy chưa chắc (${formatNumber(confidence, { fractionDigits: 2 })}) — chưa ai duyệt`, tone: 'attention' };
  }
  return null;
}

const TONE_CLASS: Record<ItemTrustLabel['tone'], string> = {
  verified: 'text-[var(--pa-ok)]',
  attention: 'text-[var(--pa-text)]',
  neutral: 'text-[var(--pa-text-3)]',
};

export function ItemTrustCard({ stores }: { readonly stores: SwapModelStores }) {
  const ids = stores.useViewer((s) => s.selection.selectedIds);
  const metadata = stores.useScene((s) => {
    const node = ids.length === 1 ? (s.nodes as Record<string, LooseNode | undefined>)[ids[0] as string] : undefined;
    return node?.type === 'item' ? node.metadata : undefined;
  });
  const label = itemTrustLabelOf(metadata);
  if (label === null) return null;

  return (
    <span
      className={`flex h-8 shrink-0 items-center whitespace-nowrap px-2.5 text-[12px] ${TONE_CLASS[label.tone]}`}
      data-tone={label.tone}
      role="status"
    >
      {label.text}
    </span>
  );
}
