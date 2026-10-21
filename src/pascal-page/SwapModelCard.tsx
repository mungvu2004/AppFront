/**
 * Thẻ "Đổi mẫu" của trang 3D: chọn đúng MỘT món đồ thì đổi được mô hình của nó sang mẫu khác
 * cùng nhóm (sofa ↔ ghế bành, giường đôi ↔ giường đơn…). Inspector của Pascal chỉ có
 * Dời/Nhân bản/Xoá nên thiếu lối này.
 *
 * Đổi = `useScene.updateNode(id, { asset })` — cùng lối inspector dùng, nên lịch sử (Ctrl+Z) của
 * Pascal ghi lại và bộ tự lưu → cầu `onSave` → PUT chạy. `asset.id` đổi sang id catalog nên lượt
 * về (`toSpatial` `itemFieldsOf`) ghi `Furniture.model { id, src }`.
 *
 * Không nhập `@pascal-app/*` (vitest không nạp được gói chưa dựng): `main.tsx` truyền store và
 * `CATALOG_ITEMS` thật vào, như `createProbe`.
 */
/* eslint-disable react-refresh/only-export-components -- hàm thuần đi kèm thẻ để test gọi thẳng. */
import { ChevronDown } from 'lucide-react';
import { useRef } from 'react';

type Vec3 = readonly [number, number, number];

/** Phần `asset` của item Pascal mà thẻ đọc/ghi (kiểu lỏng, xem `@pascal-app/core` `ItemNode`). */
export interface SwapAsset {
  readonly id: string;
  readonly category: string;
  readonly name: string;
  readonly thumbnail: string;
  readonly src: string;
  readonly dimensions?: Vec3;
  readonly offset?: Vec3;
  readonly rotation?: Vec3;
  readonly scale?: Vec3;
  readonly surface?: { readonly height: number };
  readonly [key: string]: unknown;
}

/** Một ô catalog (`CATALOG_ITEMS` đã viết lại về `/items/<thư mục>/…` lúc dựng). */
export type SwapCatalogItem = Pick<SwapAsset, 'id' | 'name' | 'thumbnail' | 'src' | 'dimensions' | 'offset' | 'rotation' | 'scale'>;

interface LooseNode {
  readonly id: string;
  readonly type: string;
  readonly asset?: SwapAsset;
}

export interface SwapModelStores {
  readonly useViewer: <T>(selector: (state: { selection: { selectedIds: readonly string[] } }) => T) => T;
  readonly useScene: {
    <T>(selector: (state: { nodes: object }) => T): T;
    getState(): { updateNode(id: string, data: object): void };
  };
}

/**
 * Nhóm đổi qua lại được, theo id catalog. Hạng mục của catalog quá thô ("furniture" có 50 mẫu,
 * gồm cả tạ và đàn piano), thẻ tag thì lúc có lúc không — nên chép tay. Cùng nhóm phải cùng kiểu
 * đặt (sàn / tường), không thì món đồ treo lơ lửng. Mẫu nào không có trong catalog cục bộ tự rơi.
 */
export const SWAP_GROUPS: readonly (readonly string[])[] = [
  ['sofa', 'livingroom-chair', 'lounge-chair', 'sunbed'],
  ['dining-chair', 'office-chair', 'herman-miller-aeron-mo8x36k9', 'stool'],
  ['double-bed', 'single-bed', 'bunkbed'],
  ['dining-table', 'dining-table-mo9ms5yh', 'coffee-table', 'office-table', 'standing-desk-mo8wgz95'],
  ['closet', 'dresser', 'bookshelf', 'ikea-kallax-1x4-moa2y49n', 'tv-stand', 'bedside-table'],
  ['kitchen', 'kitchen-cabinet', 'kitchen-counter', 'wooden-kitchen-bar-moa2hhh4'],
  ['floor-lamp', 'table-lamp'],
  ['indoor-plant', 'small-indoor-plant', 'cactus'],
  ['bush', 'fir-tree', 'palm', 'tree'],
  ['rectangular-carpet', 'round-carpet'],
  ['picture', 'round-mirror'],
  ['shower-square', 'shower-angle'],
];

/** Lệch tỉ lệ ngang/sâu tối đa khi kéo mẫu mới vào hộp cũ (cùng ý `MAX_STRETCH_RATIO` của toPascal). */
const MAX_STRETCH = 1.8;

const folderOf = (src: string): string | undefined => /^\/items\/([^/]+)\//.exec(src)?.[1];

/** Mẫu cùng nhóm với món đồ (kể cả mẫu đang dùng), theo thứ tự nhóm; [] nếu không có mẫu nào khác. */
export const swapCandidates = (asset: SwapAsset, catalog: readonly SwapCatalogItem[]): SwapCatalogItem[] => {
  const folder = folderOf(asset.src);
  const byId = new Map(catalog.map((item) => [item.id, item]));
  const group = SWAP_GROUPS.find((ids) => ids.some((id) => id === asset.id || (folder !== undefined && folderOf(byId.get(id)?.src ?? '') === folder)));
  const found = (group ?? []).flatMap((id) => byId.get(id) ?? []);
  return found.length < 2 ? [] : found;
};

export const isCurrentModel = (asset: SwapAsset, item: SwapCatalogItem): boolean => folderOf(asset.src) === folderOf(item.src);

/**
 * `asset` mới khi đổi sang `item`: giữ hộp ngang/sâu hiện tại (dimensions — `node.scale` của người
 * dùng nhân thêm sau, không đụng), cao theo catalog. Khớp bằng `asset.scale` như toPascal; lệch tỉ lệ
 * hai trục bị chặn ở `MAX_STRETCH` để ghế bành không bị kéo dài thành sofa — khi đó mẫu nhỏ hơn hộp.
 */
export const fittedAsset = (asset: SwapAsset, item: SwapCatalogItem): SwapAsset => {
  const [cw, ch, cd] = item.dimensions ?? [1, 1, 1];
  const [w, , d] = asset.dimensions ?? [cw, ch, cd];
  const lo = Math.min(w / cw, d / cd);
  const sx = Math.min(w / cw, lo * MAX_STRETCH);
  const sz = Math.min(d / cd, lo * MAX_STRETCH);
  const [kx, ky, kz] = item.scale ?? [1, 1, 1];
  const [ox, oy, oz] = item.offset ?? [0, 0, 0];
  // `surface` cũ thuộc mẫu cũ (độ cao mặt đặt đồ) — bỏ đi chứ không mang sang mẫu khác.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tách `surface` ra để bỏ.
  const { surface: _surface, ...rest } = asset;
  return {
    ...rest,
    id: item.id,
    name: item.name,
    thumbnail: item.thumbnail,
    src: item.src,
    dimensions: [cw * sx, ch, cd * sz],
    offset: [ox * sx, oy, oz * sz],
    rotation: item.rotation ?? [0, 0, 0],
    scale: [sx * kx, ky, sz * kz],
  };
};

/** Ảnh thu nhỏ catalog `/items/…` được phục vụ ở `/pascal/items/…` (`NEXT_PUBLIC_ASSETS_CDN_URL`). */
const servedUrl = (url: string): string => (url.startsWith('/items/') ? `/pascal${url}` : url);

export interface SwapModelCardProps {
  readonly stores: SwapModelStores;
  readonly catalog: readonly SwapCatalogItem[];
  readonly readOnly: boolean;
}

export function SwapModelCard({ stores, catalog, readOnly }: SwapModelCardProps) {
  const ids = stores.useViewer((s) => s.selection.selectedIds);
  const node = stores.useScene((s) =>
    ids.length === 1 ? (s.nodes as Record<string, LooseNode | undefined>)[ids[0] as string] : undefined,
  );
  const details = useRef<HTMLDetailsElement>(null);
  const asset = node?.type === 'item' ? node.asset : undefined;
  const options = asset === undefined ? [] : swapCandidates(asset, catalog);
  if (readOnly || node === undefined || asset === undefined || options.length === 0) return null;

  const choose = (item: SwapCatalogItem) => {
    stores.useScene.getState().updateNode(node.id, { asset: fittedAsset(asset, item) });
    if (details.current) details.current.open = false;
  };

  return (
    <details className="relative" data-appfront-menu="" ref={details}>
      <summary
        aria-label="Đổi mẫu — mở danh sách mẫu cùng loại"
        className="flex h-8 shrink-0 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-border bg-background/90 px-2.5 font-medium text-foreground text-xs shadow-2xl backdrop-blur-md hover:bg-accent [&::-webkit-details-marker]:hidden"
      >
        Đổi mẫu
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </summary>
      <ul
        aria-label="Mẫu cùng loại"
        className="absolute top-full left-0 z-50 mt-1 max-h-[60vh] min-w-52 overflow-y-auto rounded-xl border border-border bg-popover/95 p-1 text-xs shadow-2xl backdrop-blur-xl"
      >
        {options.map((item) => {
          const current = isCurrentModel(asset, item);
          return (
            <li key={item.id}>
              <button
                aria-pressed={current}
                className="flex h-11 w-full items-center gap-2 whitespace-nowrap rounded-lg px-2 text-left hover:bg-accent disabled:cursor-default aria-pressed:bg-accent aria-pressed:font-semibold"
                disabled={current}
                onClick={() => choose(item)}
                type="button"
              >
                <img alt="" className="h-9 w-9 shrink-0 rounded-md bg-muted object-contain" loading="lazy" src={servedUrl(item.thumbnail)} />
                {item.name}
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
