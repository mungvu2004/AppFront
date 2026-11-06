/**
 * Thẻ "Loại ô mở" của trang 3D: chọn đúng MỘT cửa hay cửa sổ (trên mặt bằng 2D hoặc trong 3D —
 * hai khung dùng chung `selection`, nên 3D viền sáng đúng ô ấy) thì đổi được cửa đi ↔ cửa sổ khi AI
 * nhận nhầm. Đổi = xoá node cũ + tạo node mới (`switchOpeningKind`) trong MỘT bước hoàn tác, rồi
 * chọn lại node mới để viền sáng vẫn ở đó. Bộ tự lưu → cầu `onSave` ghi như mọi lượt sửa.
 *
 * Không nhập `@pascal-app/*` (như `SwapModelCard`): `main.tsx` truyền store, `parseNode` (điền mặc
 * định lược đồ — `createNode` không parse) và `runAsSingleSceneHistoryStep`.
 */
import { isOpeningNode, switchOpeningKind, type SwitchableKind } from '@/lib/pascal/openingKind';

const KINDS: readonly { id: SwitchableKind; label: string }[] = [
  { id: 'door', label: 'Cửa đi' },
  { id: 'window', label: 'Cửa sổ' },
];

export interface OpeningKindStores {
  readonly useViewer: {
    <T>(selector: (state: { selection: { selectedIds: readonly string[] } }) => T): T;
    getState(): { setSelection(selection: { selectedIds: string[] }): void };
  };
  readonly useScene: {
    <T>(selector: (state: { nodes: object }) => T): T;
    getState(): { deleteNode(id: string): void; createNode(node: object, parentId?: string): void };
  };
  readonly parseNode: (node: object) => object;
  readonly singleStep: (run: () => void) => void;
}

export function OpeningKindCard({ stores, readOnly }: { readonly stores: OpeningKindStores; readonly readOnly: boolean }) {
  const ids = stores.useViewer((s) => s.selection.selectedIds);
  const node = stores.useScene((s) =>
    ids.length === 1 ? (s.nodes as Record<string, { type?: string } | undefined>)[ids[0] as string] : undefined,
  );
  if (readOnly || !isOpeningNode(node)) return null;

  const choose = (kind: SwitchableKind) => {
    const next = switchOpeningKind(node, kind);
    if (next === node) return;
    stores.singleStep(() => {
      const scene = stores.useScene.getState();
      scene.deleteNode(node.id);
      scene.createNode(stores.parseNode(next), next.parentId ?? undefined);
    });
    stores.useViewer.getState().setSelection({ selectedIds: [next.id] });
  };

  return (
    <div
      aria-label="Loại ô mở"
      className="flex h-8 shrink-0 items-center gap-0.5 rounded-xl border border-[var(--pa-border)] bg-[var(--pa-surface)] p-0.5 text-[13px] shadow-[var(--pa-shadow-float)]"
      role="group"
    >
      {KINDS.map(({ id, label }) => (
        <button
          aria-pressed={node.type === id}
          className="h-full whitespace-nowrap rounded-lg px-2.5 font-medium text-[var(--pa-text-2)] transition-colors duration-120 hover:bg-[var(--pa-sunken)] hover:text-[var(--pa-text)] aria-pressed:bg-[var(--pa-selected)] aria-pressed:text-[var(--pa-accent)] motion-reduce:transition-none outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--pa-accent)]"
          key={id}
          onClick={() => choose(id)}
          title={node.type === id ? `Đang là ${label.toLowerCase()}` : `Đổi thành ${label.toLowerCase()}`}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
