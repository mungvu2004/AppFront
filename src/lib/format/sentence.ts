/**
 * Lower-cases the first letter of a label so it can sit in the middle of a sentence
 * ("Ẩn lớp " + "Cửa đi" → "Ẩn lớp cửa đi"). Labels are written capitalised (A6) because
 * most of them stand alone; the few places that splice one into a sentence call this.
 */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLocaleLowerCase('vi') + text.slice(1);
}
