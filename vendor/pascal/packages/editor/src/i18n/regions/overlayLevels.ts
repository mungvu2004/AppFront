// Chuỗi tiếng Việt cho dấu "tầng đã có gì" trên bộ chọn tầng nổi
// (components/ui/floating-level-selector.tsx — F-15 W2-D #96). Nhãn viết hoa chữ đầu (A6).

export const overlayLevels = {
  hasScan: "Tầng đã có ảnh nguồn để đối chiếu",
  hasGeometry: "Tầng đã có hình học dựng",
  emptyLevel: "Tầng chưa có ảnh nguồn lẫn hình học",
  // F-15 W2-C2 — tách tầng liên tục (#31/#98–#101).
  explode: "Tách tầng",
  explodeHint: "Kéo để tách các tầng theo trục đứng",
  elevation: (value: string) => `Cao độ ${value} m`,
  area: (value: string) => `${value} m²`,
  misaligned: (lower: string, upper: string, offset: string) =>
    `${upper} lệch trục so với ${lower} ${offset} m`,
  // F-15 S7 — so sánh ảnh nguồn (#87–#89).
  compareTitle: "So sánh ảnh nguồn",
  compareOverlay: "Chồng lớp",
  compareSwipe: "Trượt",
  compareSideBySide: "Cạnh nhau",
  swipeHandle: "Tay cầm so sánh ảnh nguồn và hình học",
  swipeValue: (percent: number) => `Hiện ${Math.round(percent)}% ảnh nguồn`,
} as const;
