/**
 * Chữ viết tắt cho `Avatar` khi không có ảnh: chữ đầu của từ đầu và từ cuối
 * ("Nguyễn Văn Bình" → "NB"), một từ thì hai chữ đầu. Tên trống — máy chủ có thể trả
 * `name: ''` — thì lấy phần trước `@` của email (BUG-031, QA-01 nợ #8). Không còn gì
 * đọc được thì trả chuỗi rỗng.
 */
export function initialsOf(name: string, email = ''): string {
  const source = name.trim() || (email.split('@')[0] ?? '');
  const words = source.split(/\s+/).filter((word) => word !== '');
  const first = words[0];
  const last = words[words.length - 1];
  if (first === undefined || last === undefined) return '';
  const letters = words.length === 1 ? Array.from(first).slice(0, 2) : [Array.from(first)[0], Array.from(last)[0]];
  return letters.join('').toLocaleUpperCase('vi');
}
