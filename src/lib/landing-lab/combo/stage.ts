/**
 * The combo on one canvas, a pure function of p (COMBO.md, "Update 2" p map):
 * 1 book page (C ink plan, slow push-in) → 2 red pencil → 2b exploded axonometric and back down flat →
 * 3 the drawing registers onto A's printed sheet and cross-fades into the photograph → 4 A's sequence (walls rise)
 * → 5 noise dissolve from the entrance, A's white model → B's real house → 6-7 B's sequence to the door and inside.
 */

import { drawCover } from '../cinema/frames';
import { easeInOut, lerp, span, type Rect } from '../blueprint/camera';
import { Dissolve } from './dissolve';
import { drawSheet, makeKit, penScale, sheetCam } from './sheet';
import { drawGroundFloor, drawOthers, flyFrom, SPREAD } from './spread';
import { axoCam, axoPose, drawAxo } from './axo';
import type { Registration, Seq } from './sources';

export const CH = { book: [0, 0.1], ai: [0.1, 0.2], axo: [0.2, 0.32], cut: [0.32, 0.38], walls: [0.38, 0.5], real: [0.5, 0.57], walk: [0.57, 1] } as const;
/** Ink → photograph cross-fade inside chapter 3; A's sequence starts moving when it ends. */
const XFADE: readonly [number, number] = [0.345, 0.375];
const A_RUN: readonly [number, number] = [0.375, 0.5];
const FRAME_W = 1920;
const FRAME_H = 1080;
/** Where the dissolve starts: the entrance in A's last frame (fractions of the frame). */
const ENTRANCE: readonly [number, number] = [0.6, 0.62];

export interface StageInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly layer: CanvasRenderingContext2D;
  readonly W: number;
  readonly H: number;
  readonly dpr: number;
  readonly pal: { readonly paper: string; readonly ink: string; readonly red: string };
  readonly paper: CanvasPattern | string;
  readonly a: Seq | null;
  readonly b: Seq | null;
  readonly reg: Registration;
}

/** Smoothstep of a 0..1 progress (camera.ts's `smooth` takes an edge pair). */
const smooth = (t: number): number => t * t * (3 - 2 * t);
/** Where the section sits during 2b: under the text column, its level lines become the guides. */
const sectionRect = (W: number, H: number): Rect => ({ x: 0.04 * W, y: 0.6 * H, w: 0.3 * W, h: 0.26 * H });
const mix = (r: Rect, s: Rect, t: number): Rect => ({ x: lerp(r.x, s.x, t), y: lerp(r.y, s.y, t), w: lerp(r.w, s.w, t), h: lerp(r.h, s.h, t) });

/** The book plate on the right of the spread, pushed in very slowly over chapters 1-2. */
function bookRect(p: number, W: number, H: number): Rect {
  const portrait = W / H < 1.1;
  const hero: Rect = portrait ? { x: 0.04 * W, y: 0.5 * H, w: 0.92 * W, h: 0.42 * H } : { x: 0.5 * W, y: 0.14 * H, w: 0.46 * W, h: 0.72 * H };
  const plate: Rect = portrait ? { x: 0.04 * W, y: 0.4 * H, w: 0.92 * W, h: 0.5 * H } : { x: 0.4 * W, y: 0.1 * H, w: 0.56 * W, h: 0.78 * H };
  const base = mix(hero, plate, easeInOut(span(p, 0.02, 0.09)));
  const z = 1 + 0.07 * easeInOut(span(p, 0, CH.cut[0]));
  const cx = base.x + base.w / 2;
  const cy = base.y + base.h / 2;
  return { x: cx - (base.w * z) / 2, y: cy - (base.h * z) / 2, w: base.w * z, h: base.h * z };
}

/** A 1920x1080 frame rect mapped through object-fit: cover (centred) onto the W x H canvas (CSS px). */
function coverRect(r: Rect, W: number, H: number): Rect {
  const s = Math.max(W / FRAME_W, H / FRAME_H);
  const ox = (W - FRAME_W * s) / 2;
  const oy = (H - FRAME_H * s) / 2;
  return { x: ox + r.x * s, y: oy + r.y * s, w: r.w * s, h: r.h * s };
}

export function createStage(input: StageInput): { draw: (p: number, intro: number) => boolean } {
  const { ctx, layer, W, H, dpr } = input;
  const dissolve = new Dissolve(ENTRANCE);
  const w = W * dpr;
  const h = H * dpr;

  const sheet = (target: CanvasRenderingContext2D, p: number, intro: number): void => {
    const reg = input.reg;
    const t = easeInOut(span(p, CH.cut[0], XFADE[1]));
    const r = mix(bookRect(p, W, H), coverRect(reg, W, H), t);
    const cam = sheetCam(r);
    const kit = makeKit(target, input.pal, input.paper, dpr, penScale(cam));
    target.save();
    target.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (p < CH.axo[0]) {
      // 1-2: the drawing set; tầng 1 grows into the plate while the other three fade.
      drawGroundFloor(kit, p, intro, W, H, r);
      const fade = 1 - span(p, SPREAD.zoom[0], SPREAD.zoom[0] + 0.02);
      if (fade >= 1) drawOthers(kit, p, intro, W, H);
      else if (fade > 0) {
        layer.setTransform(1, 0, 0, 1, 0, 0);
        layer.clearRect(0, 0, w, h);
        layer.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawOthers({ ...kit, ctx: layer }, p, intro, W, H);
        layer.setTransform(1, 0, 0, 1, 0, 0);
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.globalAlpha = fade;
        target.drawImage(layer.canvas, 0, 0);
        target.globalAlpha = 1;
      }
    } else if (p < CH.axo[1]) {
      // 2b keeps the plan's pen scale (from `cam`) while its own camera tilts and frames the exploded stack.
      const ps = axoPose(span(p, CH.axo[0], CH.axo[1]));
      drawAxo(kit, axoCam(ps, r), ps, { section: sectionRect(W, H), from: flyFrom(W, H) });
    } else {
      if (reg.rot !== 0 && t > 0) {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        target.translate(cx, cy);
        target.rotate(reg.rot * t);
        target.translate(-cx, -cy);
      }
      drawSheet(kit, cam, { d: 1, intro: 1, q: 1, under: 0 });
    }
    target.restore();
  };

  // No sequence at all = nothing to wait for (true); a sequence whose frames are still loading = redraw later (false).
  // Nearest frame only (no neighbour cross-fade): one full-screen draw per sequence keeps p95 down on Intel UHD.
  const seqAt = (seq: Seq | null, f: number, c: CanvasRenderingContext2D): boolean => {
    if (seq === null) return true;
    const i = Math.min(seq.count - 1, Math.max(0, Math.round(f)));
    const img = seq.store.exact(i) ?? seq.store.nearest(i);
    if (img !== null) drawCover(c, img, img.naturalWidth, img.naturalHeight, w, h, 0.5);
    return seq.store.exact(i) !== null;
  };

  const draw = (p: number, intro: number): boolean => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    const x = smooth(span(p, XFADE[0], XFADE[1]));
    let ok = true;

    if (p < CH.real[0]) {
      const a = input.a;
      if (x > 0 && a !== null) {
        const fa = span(p, A_RUN[0], A_RUN[1]) * (a.count - 1);
        ctx.globalAlpha = x;
        ok = seqAt(a, fa, ctx);
        ctx.globalAlpha = 1;
      }
      if (x < 1) {
        if (x <= 0) sheet(ctx, p, intro);
        else {
          layer.setTransform(1, 0, 0, 1, 0, 0);
          layer.clearRect(0, 0, w, h);
          sheet(layer, p, intro);
          ctx.globalAlpha = 1 - x;
          ctx.drawImage(layer.canvas, 0, 0);
          ctx.globalAlpha = 1;
        }
      }
      return ok;
    }
    const b = input.b;
    if (p < CH.walk[0]) {
      // 5: B's first frame underneath, A's last frame on top through the spreading mask.
      const t = smooth(span(p, CH.real[0], CH.real[1]));
      ok = seqAt(b, 0, ctx);
      const a = input.a;
      if (a !== null && t < 1) {
        layer.setTransform(1, 0, 0, 1, 0, 0);
        layer.globalCompositeOperation = 'source-over';
        layer.clearRect(0, 0, w, h);
        ok = seqAt(a, a.count - 1, layer) && ok;
        layer.globalCompositeOperation = 'destination-in';
        drawCover(layer, dissolve.update(t), dissolve.width, dissolve.height, w, h, 0.5);
        layer.globalCompositeOperation = 'source-over';
        ctx.drawImage(layer.canvas, 0, 0);
      }
      return ok;
    }
    return b === null ? true : seqAt(b, span(p, CH.walk[0], CH.walk[1]) * (b.count - 1), ctx);
  };

  return { draw };
}
