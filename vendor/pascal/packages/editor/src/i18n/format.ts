// Bộ định dạng số dùng chung cho chuỗi UI tiếng Việt: dấu phẩy thập phân, có khoảng
// trắng trước đơn vị. Dùng trong i18n/vi.ts (các khoá hàm) và bất cứ đâu số hiển thị
// trực tiếp lên màn (không phải log/console/dev-overlay).
const numberFormat = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Định dạng một số theo kiểu Việt Nam (dấu phẩy thập phân), không đơn vị. */
export function formatNumberVi(value: number): string {
  return numberFormat.format(value);
}

/** Định dạng số kèm đơn vị, có khoảng trắng trước đơn vị, ví dụ "2,40 m". */
export function formatWithUnitVi(value: number, unit: string): string {
  return `${formatNumberVi(value)} ${unit}`;
}
