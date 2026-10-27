const SHOWN_NAMES = 6;

/** `ch-01, ch-02` (≤ 6 tên), dài hơn thì 6 tên đầu và "và N tầng khác" — giữ mỗi dòng một hàng. */
export function floorNamesOf(names: readonly string[]): string {
  const rest = names.length - SHOWN_NAMES;
  const shown = names.slice(0, SHOWN_NAMES).join(', ');
  return rest > 0 ? `${shown} và ${rest} tầng khác` : shown;
}
