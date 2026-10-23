/**
 * `"48 tường"` → số `"48"` + nhãn `"tường"` để in "số lớn + nhãn nhỏ" (aesthetic 2.5 #3). Chỉ tách
 * chuỗi đã định dạng ở khoảng trắng đầu tiên — không đụng tới số (A15). Không có khoảng trắng thì
 * cả chuỗi là phần số.
 */
export function splitMetricLabel(metric: string): { readonly value: string; readonly unit: string } {
  const space = metric.indexOf(' ');
  return space < 0 ? { value: metric, unit: '' } : { value: metric.slice(0, space), unit: metric.slice(space + 1) };
}
