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
    title: 'Điều khiển góc nhìn bằng chuột',
    body: 'Giữ chuột phải và kéo để xoay. Lăn chuột để phóng to hoặc thu nhỏ. Để kéo khung hình, giữ chuột giữa hoặc giữ phím Space cùng chuột trái.',
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
    body: 'Chọn tầng ở ô tầng bên trái. Nhóm nút 3D, 2D và Chia đôi ở thanh trên đổi cách xem mô hình.',
    anchor: { selector: 'button[aria-label="3D"]', up: 1 },
  },
  {
    title: 'Đổi diện mạo cảnh rồi sang bước sau',
    body: 'Hai nút Phong cách và Ánh sáng ở thanh trên đổi diện mạo cảnh. Mọi thay đổi tự lưu, chip cạnh nút về dự án cho biết đã lưu chưa. Xong thì bấm "Sang Quy chuẩn"; nếu nút ghi "Hiệu chỉnh tỷ lệ" thì hiệu chỉnh trước. Bấm nút Hướng dẫn bất cứ lúc nào để xem lại.',
    // Nhóm Phong cách (thẻ `<details>`); Ánh sáng nằm ngay cạnh.
    anchor: { selector: 'summary[aria-label^="Phong cách"]', up: 1 },
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
