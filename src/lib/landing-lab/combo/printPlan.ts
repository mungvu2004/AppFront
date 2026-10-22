/**
 * Contract 1 (COMBO.md): C's finished ground-floor sheet as a transparent PNG for A's printed sheet,
 * with the exact image px <-> plan metre mapping (walls.json frame; Blender X = x, Y = -y).
 */

import { drawSheet, makeKit, penScale, SHEET, sheetCam } from './sheet';
import type { Palette } from '../blueprint/pen';

export interface PrintPlan {
  readonly png: string;
  readonly meta: Record<string, unknown>;
}

export function renderPrintPlan(pal: Palette, width = 4096): PrintPlan {
  const height = Math.round((width * SHEET.h) / SHEET.w);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('no 2d context');
  const cam = sheetCam({ x: 0, y: 0, w: width, h: height });
  // Transparent sheet: "paper" fills (sills, gaps) stay see-through so the print's own paper shows.
  const kit = makeKit(ctx, pal, 'rgba(0,0,0,0)', 1, penScale(cam));
  drawSheet(kit, cam, { d: 1, intro: 1, q: 1, under: 0 });
  const pxPerM = (cam.s * 1000);
  return {
    png: canvas.toDataURL('image/png'),
    meta: {
      image_px: [width, height],
      px_per_m: pxPerM,
      plan_window_m: { x0: SHEET.x0 / 1000, y0: SHEET.y0 / 1000, w: SHEET.w / 1000, h: SHEET.h / 1000 },
      mapping:
        'image px (u, v), origin top-left: x_m = x0 + u / px_per_m, y_m = y0 + v / px_per_m (plan y runs DOWN the image, street at the top, ' +
        'same as the shared plan SVGs). Blender: X = x_m, Y = -y_m. Image top-left = Blender (x0, -y0); +u = +X, +v = -Y.',
      blender_plane: {
        size_m: [SHEET.w / 1000, SHEET.h / 1000],
        centre_xy: [(SHEET.x0 + SHEET.w / 2) / 1000, -(SHEET.y0 + SHEET.h / 2) / 1000],
        note: 'primitive_plane_add(size=1), scale (w, h, 1), default UVs map the image upright (as shared/README).',
      },
      contents: 'ground floor T1 ink plan (poché walls, doors, windows, furniture, stair, terrace, dims, grid axes, room tags, scale bar, north arrow) + red-pencil AI marks',
      colours: { ink: pal.ink, red: pal.red },
      illustrative: 'Dữ liệu minh hoạ',
    },
  };
}
