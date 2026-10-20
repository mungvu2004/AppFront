/**
 * Ghép ảnh cạnh nhau (C11) và đo màu sàn theo Lab (C10) bằng sharp — dùng cho
 * `pascal-fixtures.visual.spec.ts`. Chỉ chạy trong Node (Playwright), không vào bundle.
 */
import sharp from 'sharp';

type Pt = readonly [number, number];

const LABEL_H = 48;

const labelSvg = (text: string, width: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_H}">` +
      `<rect width="100%" height="100%" fill="#111"/>` +
      `<text x="16" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#fff">${text}</text></svg>`,
  );

/** Hai ảnh cao bằng nhau đặt cạnh nhau, mỗi ảnh có nhãn phía trên. */
export const sideBySide = async (panels: readonly { png: Buffer; label: string }[], out: string, height = 720) => {
  const resized = await Promise.all(
    panels.map(async ({ png, label }) => {
      const img = await sharp(png).resize({ height }).png().toBuffer();
      const { width = height } = await sharp(img).metadata();
      return { img, label, width };
    }),
  );
  const total = resized.reduce((s, p) => s + p.width, 0);
  let left = 0;
  const layers = resized.flatMap(({ img, label, width }) => {
    const at = left;
    left += width;
    return [
      { input: labelSvg(label, width), left: at, top: 0 },
      { input: img, left: at, top: LABEL_H },
    ];
  });
  await sharp({ create: { width: total, height: height + LABEL_H, channels: 3, background: '#000' } })
    .composite(layers)
    .png()
    .toFile(out);
};

/** sRGB 0..255 → CIE Lab (D65). */
export const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const fy = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const fz = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

const inside = ([x, y]: Pt, poly: readonly Pt[]) => {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : Number.NaN;
};

/** Khoảng cách từ điểm tới cạnh gần nhất của đa giác (điểm ảnh). */
const edgeDistance = ([x, y]: Pt, poly: readonly Pt[]) => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]!;
    const [bx, by] = poly[i]!;
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len2 ? Math.min(1, Math.max(0, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * (bx - ax), y - ay - t * (by - ay)));
  }
  return best;
};

/**
 * Lab trung vị trong `poly` (toạ độ điểm ảnh) trừ các vùng `masks`, bỏ dải `inset` điểm ảnh
 * sát mép (chân tường, viền) — tính theo khoảng cách tới cạnh nên đúng cả với phòng chữ L.
 */
export const medianLabIn = async (png: Buffer, poly: readonly Pt[], masks: readonly (readonly Pt[])[], inset = 15) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const L: number[] = [];
  const A: number[] = [];
  const B: number[] = [];
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y < Math.min(info.height, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x < Math.min(info.width, Math.ceil(Math.max(...xs))); x++) {
      const p: Pt = [x + 0.5, y + 0.5];
      if (!inside(p, poly) || edgeDistance(p, poly) < inset || masks.some((m) => inside(p, m))) continue;
      const i = (y * info.width + x) * info.channels;
      const [l, a, b] = rgbToLab(data[i]!, data[i + 1]!, data[i + 2]!);
      L.push(l);
      A.push(a);
      B.push(b);
    }
  }
  return { lab: [median(L), median(A), median(B)] as const, pixels: L.length };
};

/** ΔE chỉ trên a*b* (bỏ L* để ánh sáng không chi phối). */
export const deltaAB = (p: readonly number[], q: readonly number[]) => Math.hypot(p[1]! - q[1]!, p[2]! - q[2]!);
