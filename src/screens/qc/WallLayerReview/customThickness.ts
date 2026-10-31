export const CUSTOM_MIN_MM = 60;
export const CUSTOM_MAX_MM = 600;

/** UX-10: số người gõ, hợp lệ khi là số nguyên trong 60–600 mm; còn lại `null`. */
export function parseCustomThickness(text: string): number | null {
  const value = Number(text.trim());

  return Number.isInteger(value) && value >= CUSTOM_MIN_MM && value <= CUSTOM_MAX_MM ? value : null;
}
