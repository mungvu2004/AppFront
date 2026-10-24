/** Cửa sổ so le của nét vẽ: nét đầu bắt đầu ngay, nét cuối sau ngần này. */
const DRAW_STAGGER_MS = 900;
const SHAPE = /<(polygon|circle|line|path|rect)\b/gu;

/**
 * Chuẩn bị SVG cho màn vẽ nét (`landing.css`, `.auth-plan-draw`): mỗi hình được `pathLength="1"` để một
 * `stroke-dasharray: 1` vẽ trọn nét bất kể độ dài thật, và độ trễ `--d` theo thứ tự xuất hiện (nền đất → nhà
 * → cây) — nét mực lan dần như đang vẽ tay.
 */
export function drawablePlan(svg: string): string {
  const total = svg.match(SHAPE)?.length ?? 1;
  let index = 0;

  return svg.replace(SHAPE, (_match, tag: string) => {
    const delay = Math.round((index / total) * DRAW_STAGGER_MS);
    index += 1;

    return `<${tag} pathLength="1" style="--d:${delay}ms"`;
  });
}
