/** Logic thuần của hướng dẫn thao tác trang 3D (không nhập `@pascal-app/*` để vitest chạy được). */

export const TOUR_KEY = 'appfront.pascal.tour.v1';
export const TOUR_OPEN_EVENT = 'pascal-tour:open';

export interface TourStep {
  readonly title: string;
  readonly body: string;
  /** Phím hiển thị bằng chip kbd. */
  readonly keys?: readonly string[];
  /** Selector bền của phần tử thật; `up` = lấy cha thứ n (nhóm nút). Không thấy thì thẻ hiện giữa dưới. */
  readonly anchor?: { readonly selector: string; readonly up?: number };
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'Xem nhà 3D và sửa chỗ chưa đúng',
    body: 'Màn này dựng nhà của bạn thành mô hình 3D từ bản vẽ. Ở đây bạn xem nhà, sửa chỗ AI làm sai (tường, cửa, đồ đạc) và làm đẹp. Kéo chuột trái (hoặc chuột phải) để xoay. Giữ Shift và kéo để chọn nhiều đối tượng bằng khung. Lăn chuột để phóng to hoặc thu nhỏ. Để kéo khung hình, giữ chuột giữa hoặc giữ phím Space cùng chuột trái.',
    keys: ['Space'],
    anchor: { selector: 'canvas' },
  },
  {
    title: 'Công cụ dựng ở thanh bên trái',
    body: 'Mở tab Dựng để vẽ tường, đặt cửa, cửa sổ và các công cụ khác. Tab Đồ vật chứa đồ nội thất để đặt vào phòng.',
    anchor: { selector: '[data-slot][aria-label="Dựng"]', up: 1 },
  },
  {
    title: 'Chọn một vật để xem và sửa',
    body: 'Chọn công cụ Chọn ở thanh dưới (phím V), rồi bấm vào một vật trong cảnh. Bảng thuộc tính hiện ra để bạn xem và chỉnh. Nhấn Esc để thoát công cụ đang dùng.',
    keys: ['V', 'Esc'],
    anchor: { selector: 'div.fixed.bottom-6.rounded-2xl' },
  },
  {
    title: 'Đổi tầng và chế độ xem 3D/2D',
    body: 'Chọn tầng ở thẻ Cảnh của bảng trái. Nút 3D ▾ ở bảng Xem góc phải đổi cách xem mô hình (3D, 2D, Chia đôi); nút Tường ▾ cạnh đó đổi cách hiện tường.',
    anchor: { selector: 'button[data-appfront-viewmode]', up: 1 },
  },
  {
    title: 'Đổi diện mạo cảnh rồi sang bước sau',
    body: 'Menu Xem ở góc phải đổi phong cách, ánh sáng, chất lượng hình và cách hiển thị. Đồ đạc, tường, cửa sổ và vật liệu trong thư viện được lưu tự động; chấm cạnh nút về dự án (đầu bảng trái) cho biết đã lưu chưa. Kiểu cửa, màu trần và màu tự pha hiện chưa lưu được. Xong thì bấm "Sang Quy chuẩn"; nếu cạnh đó có nút "Đặt tỷ lệ" thì nên đặt tỷ lệ trước. Bấm nút Hướng dẫn bất cứ lúc nào để xem lại.',
    // Menu Xem (thẻ `<details>`, ViewMenu.tsx).
    anchor: { selector: 'summary[aria-label^="Xem"]', up: 1 },
  },
];

type Store = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStore = (): Store | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Tự bật khi chưa xem; bộ nhớ chặn/lỗi thì KHÔNG bật (tránh hiện lại mãi). */
export function shouldAutoOpen(store: Store | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    return store.getItem(TOUR_KEY) !== 'done';
  } catch {
    return false;
  }
}

export function markDone(store: Store | null = defaultStore()): void {
  try {
    store?.setItem(TOUR_KEY, 'done');
  } catch {
    /* bộ nhớ bị chặn */
  }
}

/** Màn chờ của editor Pascal (`scene-loader.tsx`, lớp `pascal-loader-N` trong `pascal.css`). */
const SCENE_LOADER = '[class*="pascal-loader-"]';
/** Canvas còn cỡ mặc định 300×150 nghĩa là khung chưa đo xong. */
const MIN_CANVAS = { width: 400, height: 300 } as const;

/** Editor còn đang dựng cảnh (màn chờ của Pascal còn hiện). */
export function isSceneLoading(root: ParentNode = document): boolean {
  // UX-R3 U10: chỉ tính màn chờ còn hiện thật; phần tử bị ẩn (display/visibility/opacity) còn sót trong
  // DOM từng giữ chữ "Đang dựng" đè lên mô hình đã hiện. jsdom không có `checkVisibility` → coi là hiện.
  return Array.from(root.querySelectorAll(SCENE_LOADER)).some(
    (el) =>
      (el as { checkVisibility?: (o: object) => boolean }).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true,
  );
}

/** Quá lâu chưa thấy mô hình (dự án chưa có tường) thì thôi báo đang dựng. */
export const SCENE_WAIT_MAX_MS = 30_000;

/** Cảnh đã sẵn sàng: hết màn chờ, đã có mô hình (`hasModel`, UX-R3 U10) và canvas đã có kích thước thật. */
/** Tường/sàn đã vẽ xong lần đầu (`realism/warm.ts` → `__pascalWarm().structDrawnAt`): màn chờ đang mờ dần cũng thôi tính. */
export function structureDrawn(win: Window = window): boolean {
  const warm = (win as { __pascalWarm?: () => { structDrawnAt?: number } }).__pascalWarm;
  return (warm?.().structDrawnAt ?? 0) > 0;
}

export function isSceneReady(root: ParentNode = document, hasModel: () => boolean = () => true): boolean {
  if (!hasModel() || (isSceneLoading(root) && !structureDrawn())) return false;
  return Array.from(root.querySelectorAll('canvas')).some((c) => {
    const r = c.getBoundingClientRect();
    return r.width >= MIN_CANVAS.width && r.height >= MIN_CANVAS.height;
  });
}

export const HINT_TEXT = 'Kéo chuột để xoay, lăn chuột để phóng to.';
/**
 * HIG 04/11: thẻ thao tác nhanh của vật đang chọn (`HomeownerCard`, "giường · Xoay 90° · Xoá · Hoàn tác") đứng
 * cùng chỗ giữa cạnh dưới với gợi ý lần đầu — khi thẻ đó hiện thì gợi ý nhường (ẩn, không đánh dấu đã xem).
 */
export const SELECTION_CARD = '[data-appfront-homeowner-card]';
export const isSelectionCardShown = (root: ParentNode = document): boolean => root.querySelector(SELECTION_CARD) !== null;
/**
 * HIG-A vòng 4: hộp thoại đang mở (Cài đặt › Phím tắt…) — gợi ý lần đầu (z cao) đè dòng cuối của nó, nên nhường.
 * Radix Dialog của Pascal (`primitives/dialog.tsx`, mà `keyboard-shortcuts-dialog.tsx` dùng) gắn `data-slot` + `data-state`;
 * `role="alertdialog"` / `aria-modal="true"` phủ các hộp thoại khác.
 * Không dùng `[role="dialog"]` trần: popover Radix và thẻ tour (`aria-modal="false"`) cũng mang role đó.
 */
export const OPEN_DIALOG =
  '[data-slot="dialog-content"][data-state="open"], [data-slot="alert-dialog-content"][data-state="open"], [role="alertdialog"], [role="dialog"][aria-modal="true"]';
export const isDialogOpen = (root: ParentNode = document): boolean => root.querySelector(OPEN_DIALOG) !== null;
/**
 * UX-R2 K38: gợi ý lần đầu đứng giữa cạnh dưới, ngay trên thanh công cụ dưới (`fixed bottom-6`, cao
 * ~52px) — không còn dưới cụm trợ giúp đầu cảnh, nơi nó đè lên mô hình.
 */
export const HINT_BOTTOM_PX = 88;

export function requestTour(): void {
  window.dispatchEvent(new Event(TOUR_OPEN_EVENT));
}

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export const CARD_W = 320;
const GAP = 12;
const MARGIN = 16;
/** Chừa dải dưới cho thanh công cụ dưới (dock `bottom-6`, cao ~56px) khi thẻ rơi về góc/giữa dưới. */
const DOCK_CLEAR = 96;

/** Neo gần cả khung nhìn (canvas) thì không khoét lỗ. */
export const isHuge = (a: Box, vw: number, vh: number): boolean => a.width > vw * 0.7 && a.height > vh * 0.6;

/** Đặt thẻ cạnh phần tử neo (dưới, trên, phải, trái), kẹp trong khung nhìn; không neo thì giữa dưới. */
export function placeCard(
  anchor: Box | null,
  cardH: number,
  vw: number,
  vh: number,
): { left: number; top: number } {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, Math.max(lo, hi)));
  const x = (v: number) => clamp(v, MARGIN, vw - CARD_W - MARGIN);
  const y = (v: number) => clamp(v, MARGIN, vh - cardH - MARGIN);
  const low = Math.max(MARGIN, vh - cardH - DOCK_CLEAR);
  if (!anchor || anchor.width <= 0 || anchor.height <= 0) {
    return { left: x((vw - CARD_W) / 2), top: low };
  }
  // Góc phải dưới (như thẻ hướng dẫn của màn 2D), đặt trên dock để không che thanh công cụ.
  if (isHuge(anchor, vw, vh)) return { left: x(vw), top: low };
  const cx = anchor.left + anchor.width / 2 - CARD_W / 2;
  const cy = anchor.top + anchor.height / 2 - cardH / 2;
  const below = anchor.top + anchor.height + GAP;
  const above = anchor.top - GAP - cardH;
  const right = anchor.left + anchor.width + GAP;
  const left = anchor.left - GAP - CARD_W;
  if (below + cardH <= vh - MARGIN) return { left: x(cx), top: below };
  if (above >= MARGIN) return { left: x(cx), top: above };
  if (right + CARD_W <= vw - MARGIN) return { left: right, top: y(cy) };
  if (left >= MARGIN) return { left, top: y(cy) };
  return { left: x(vw), top: low };
}

export function resolveAnchor(step: TourStep, root: ParentNode = document): HTMLElement | null {
  if (!step.anchor) return null;
  try {
    let el = root.querySelector<HTMLElement>(step.anchor.selector);
    for (let i = 0; el && i < (step.anchor.up ?? 0); i++) el = el.parentElement;
    return el;
  } catch {
    return null;
  }
}
