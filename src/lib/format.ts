export function formatNumberVi(value: number, fractionDigits = 2): string {
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatMm(mm: number): string {
  return `${formatNumberVi(mm, 0)} mm`;
}

export function formatM(m: number): string {
  return `${formatNumberVi(m, 1)} m`;
}

export function formatM2(m2: number): string {
  return `${formatNumberVi(m2, 2)} m²`;
}

export function formatScale(ratio: number): string {
  // e.g. if ratio is 100, "1:100"
  // Assuming scaleRatioMmPerPx = 12 means scale is roughly something else, but 
  // brief: "tỷ lệ 1:100"
  return `1:${ratio}`;
}

export function formatCoordinates(x: number, y: number): string {
  return `X: ${formatNumberVi(x, 2)}  Y: ${formatNumberVi(y, 2)}`;
}

export function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export function formatProgressString(completed: number, total: number, entityName: string): string {
  return `${completed}/${total} ${entityName} đã duyệt`;
}
