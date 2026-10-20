/**
 * Chữ của trang /welcome và hai hàm thuần quyết định lúc nào chữ hiện.
 *
 * Chữ nằm trong DOM (đọc được, chọn được, có tiêu đề ngữ nghĩa), không vẽ trong
 * canvas. Độ mờ và độ trượt của mỗi dòng chỉ phụ thuộc vào `p` và khoảng của
 * cảnh nó thuộc về, nên cuộn ngược ra đúng khung hình cũ.
 */

/** Chỉ số cảnh (theo SCENES) → chữ. Cảnh 6 (đi trong nhà) chỉ có nhãn phòng. */
export interface SceneCopy {
  readonly scene: number;
  readonly title: string;
  readonly sub?: string;
  readonly note?: string;
}

export const SCENE_COPY: readonly SceneCopy[] = [
  { scene: 0, title: 'Bản vẽ biết trở thành ngôi nhà.', sub: 'Từ mặt bằng 2D đến mô hình 3D có thể kiểm tra.' },
  { scene: 1, title: 'Từ bản vẽ đến hình học có thể đo lường.' },
  { scene: 2, title: 'AI nhận diện. Hình học bắt đầu có ý nghĩa.', note: 'Dữ liệu minh hoạ' },
  { scene: 3, title: 'Bạn kiểm tra. Bạn quyết định.' },
  { scene: 4, title: 'Từ nét vẽ. Thành không gian thật.' },
  { scene: 6, title: 'Hai tầng. Một mô hình thống nhất.' },
  { scene: 7, title: 'Không chỉ dựng hình. Còn giúp phát hiện vấn đề.', note: 'Dữ liệu minh hoạ' },
];

/** Nhãn gắn vào mô hình: id neo → chữ và sắc (dùng cho viền màu nhỏ). */
export const LABELS: readonly { id: string; text: string; tone: 'blue' | 'amber' | 'jade' | 'coral' }[] = [
  { id: 'det:F1', text: 'Giường · 0,94', tone: 'blue' },
  { id: 'det:F3', text: 'Sofa · 0,89', tone: 'blue' },
  { id: 'det:F4', text: 'Bàn ăn · 0,90', tone: 'blue' },
  { id: 'gap', text: 'Đoạn tường bị hở', tone: 'amber' },
  { id: 'room:R1', text: 'Phòng khách · 25 m²', tone: 'jade' },
  { id: 'room:R2', text: 'Bếp + ăn · 35 m²', tone: 'jade' },
  { id: 'room:R3', text: 'Phòng ngủ 1 · 20 m²', tone: 'jade' },
  { id: 'room:R6', text: 'Phòng ngủ 2 · 16 m²', tone: 'jade' },
  { id: 'room:R7', text: 'Phòng làm việc · 40 m²', tone: 'jade' },
  { id: 'room:R8', text: 'Phòng ngủ 3 · 32 m²', tone: 'jade' },
  { id: 'stair', text: 'Cầu thang · 16 bậc', tone: 'jade' },
  { id: 'check:C4', text: 'Cửa WC 0,70 m · cần ≥ 0,75 m', tone: 'coral' },
  { id: 'check:C7', text: 'Bậc 18,75 cm · cần ≤ 18 cm', tone: 'coral' },
];

export const SUMMARY = '12 mục · 10 đạt · 2 cần sửa';

/** Dùng khi LANDING_HOUSE.checks chưa tải hoặc thiếu gợi ý. */
export const DEFAULT_SUGGESTIONS: readonly string[] = [
  'Mở rộng cửa WC lên tối thiểu 0,75 m.',
  'Chia lại bậc thang để mỗi bậc cao tối đa 18 cm.',
];

export const EXPORTS: readonly { format: string; label: string }[] = [
  { format: 'GLB', label: 'Xem 3D' },
  { format: 'IFC', label: 'BIM' },
  { format: 'PDF', label: 'Bản in' },
  { format: 'JSON', label: 'Dữ liệu' },
  { format: 'PNG', label: 'Chia sẻ' },
];

export const FINAL = { title: 'Bản vẽ của bạn.', sub: 'Bắt đầu một công trình mới.' } as const;

/** Sáu bước của sản phẩm, cho bản tĩnh. */
export const STEPS: readonly { title: string; text: string }[] = [
  { title: 'Tải lên', text: 'Ảnh chụp, bản quét hoặc PDF của mặt bằng.' },
  { title: 'Nhận diện', text: 'Tường, phòng, cửa và đồ đạc được nhận ra từ bản vẽ.' },
  { title: 'Rà soát', text: 'Bạn kiểm tra từng tầng và sửa chỗ nhận diện chưa đúng.' },
  { title: 'Dựng 3D', text: 'Một công trình thống nhất về kích thước, có thể khám phá.' },
  { title: 'Kiểm tra', text: `Đối chiếu yêu cầu đã cấu hình: ${SUMMARY}.` },
  { title: 'Xuất', text: 'GLB, IFC, PDF, JSON và PNG.' },
];

/* -------------------------------------------------------------------------- */

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const easeOut = (t: number): number => 1 - (1 - t) ** 3; // vào: nhanh rồi dịu
const easeIn = (t: number): number => t * t; // ra: chậm rồi dứt

const ENTER = 0.2; // phần của cảnh dành cho lúc vào
const LEAVE = 0.16;
const TRAVEL_IN = 20; // px
const TRAVEL_OUT = 12;

export interface CopyPhase {
  readonly opacity: number;
  readonly y: number;
}

/**
 * Độ mờ và độ trượt của một dòng chữ trong cảnh [start, end].
 * `delay` (0..1, theo độ dài cảnh) lùi lúc vào để dòng phụ đến sau dòng chính.
 * `holdAtEnd` giữ nguyên ở cảnh cuối thay vì rời đi; `holdAtStart` bỏ lúc vào
 * (cảnh đầu: trang mở ra ở p = 0 phải đã có chữ).
 */
export function copyPhase(p: number, start: number, end: number, delay = 0, holdAtEnd = false, holdAtStart = false): CopyPhase {
  const len = end - start;
  if (p < start || p > end || len <= 0) {
    return { opacity: 0, y: 0 };
  }
  const local = (p - start) / len;
  const into = holdAtStart ? 1 : easeOut(clamp01((local - delay) / ENTER));
  const out = holdAtEnd ? 0 : easeIn(clamp01((local - (1 - LEAVE)) / LEAVE));

  return {
    opacity: Math.max(0, into * (1 - out)),
    y: (1 - into) * TRAVEL_IN - out * TRAVEL_OUT,
  };
}
