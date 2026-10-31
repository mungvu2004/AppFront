/**
 * Đếm thao tác sửa chưa gửi lên máy chủ — cho dải "Mất mạng · N thao tác đang chờ gửi" (UX-40).
 *
 * Module trơn, không kéo store: dải đứng ở cổng phiên, nằm trong chunk vào.
 * Saver lớp tầng tăng đếm mỗi lần kho đổi do người sửa, và về 0 khi không còn tầng nào chưa lưu.
 */
let count = 0;
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((listener) => listener());

export function notePendingEdit(): void {
  count += 1;
  emit();
}

export function clearPendingEdits(): void {
  if (count === 0) return;
  count = 0;
  emit();
}

export const getPendingEdits = (): number => count;

export function subscribePendingEdits(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
