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
} as const;
