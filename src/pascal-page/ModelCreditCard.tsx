/**
 * Ghi công mẫu 3D tải về (CC-BY bắt buộc ghi tên tác giả): chọn đúng một món đồ dùng mẫu thư viện
 * máy chủ có ghi công thì hiện "Mẫu 3D: <tác giả> · <giấy phép>" trong cụm chỉnh cảnh.
 */
import { serverAttributionOf } from '@/lib/pascal/furnitureCatalog';

import type { SwapModelStores } from './SwapModelCard';

interface LooseNode {
  readonly type: string;
  readonly asset?: { readonly id: string };
}

export function ModelCreditCard({ stores }: { readonly stores: SwapModelStores }) {
  const ids = stores.useViewer((s) => s.selection.selectedIds);
  const assetId = stores.useScene((s) => {
    const node = ids.length === 1 ? (s.nodes as Record<string, LooseNode | undefined>)[ids[0] as string] : undefined;
    return node?.type === 'item' ? node.asset?.id : undefined;
  });
  const credit = assetId === undefined ? undefined : serverAttributionOf(assetId);
  if (credit === undefined) return null;

  return (
    <span className="flex h-8 shrink-0 items-center whitespace-nowrap px-2.5 text-[12px] text-[var(--pa-text-3)]">
      Mẫu 3D: {credit}
    </span>
  );
}
