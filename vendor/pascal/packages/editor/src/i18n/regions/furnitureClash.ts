// Chuỗi tiếng Việt cho bảng "Va chạm đồ đạc" của editor Pascal
// (lib/floorplan/furniture-clash.ts, components/ui/panels/furniture-clash-panel.tsx).
// Nhãn viết hoa chữ đầu (AppFront A6).

export const furnitureClash = {
  title: "Va chạm đồ đạc",
  none: "Không có đồ đạc nào chồng lên nhau.",
  row: (a: string, b: string) => `«${a}» chồng lên «${b}»`,
  ruleLabel: "Quy tắc",
  select: (a: string) => `Chọn «${a}»`,
} as const;
