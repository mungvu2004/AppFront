/**
 * The combo on one canvas, a pure function of story p (map in layout.ts, scroll in timeline.ts):
 * 1 drawing set → 2 red pencil → 2b exploded axonometric and back down flat → 3 the drawing registers onto A's
 * printed sheet and cross-fades into the photograph → 4 A's sequence (walls rise) → 5 the camera keeps moving:
 * A's desk → B's clay bridge → materials paint in from the entrance → 6-7 B to the door and inside.
 * `ready` / `prefetch` serve the timeline's frame gate; `hits` serves the pointer.
 */

import { easeInOut, span } from '../blueprint/camera';
import { FLOORS, type Floor, type V2 } from '../blueprint/model';
import { drawCover } from '../cinema/frames';
import { axoCam, axoPose, drawAxo } from './axo';
import { Dissolve } from './dissolve';
import { drawRoomHover, emptyHits, PARALLAX_PX, type Hits, type Ui } from './interact';
import {
  A_RUN,
  bookRect,
  CH,
  coverRect,
  ENTRANCE,
  INSIDE_AT,
  mix,
  sectionRect,
  smooth,
  WALK_END,
  XFADE,
} from './layout';
import { drawSheet, makeKit, penScale, sheetCam } from './sheet';
import type { Registration, Seq } from './sources';
import { drawGroundFloor, drawOthers, flyFrom, miniCams, SPREAD } from './spread';
import { FLAT, NEEDS } from './timeline';

export interface StageInput {
  readonly ctx: CanvasRenderingContext2D;
  readonly layer: CanvasRenderingContext2D;
  readonly W: number;
  readonly H: number;
  readonly dpr: number;
  readonly pal: {
    readonly paper: string;
    readonly ink: string;
    readonly red: string;
    readonly clay: string;
  };
  readonly paper: CanvasPattern | string;
  readonly a: Seq | null;
  readonly b: Seq | null;
  /** B's white-clay pass of the bridge frames (null: a desaturated stand-in). */
  readonly clay: Seq | null;
  readonly reg: Registration;
}

export interface Stage {
  /** Draws story p; false when a needed frame is not decoded yet (draw again when it lands). */
  readonly draw: (p: number, intro: number, ui: Ui) => boolean;
  /** Readiness gate: are the frames story p needs decoded (or close enough for nearest-frame drawing)? */
  readonly ready: (p: number) => boolean;
  /** Starts downloading the next chapter's frames one chapter ahead. */
  readonly prefetch: (p: number, scrolling?: boolean) => void;
  /** What the last draw put on screen, for pointer hit tests. */
  readonly hits: () => Hits;
}

export function createStage(input: StageInput): Stage {
  const { ctx, layer, W, H, dpr } = input;
  const dissolve = new Dissolve(ENTRANCE);
  const w = W * dpr;
  const h = H * dpr;
  let hits = emptyHits();
  const floor = (id: string): Floor | undefined => FLOORS.find((f) => f.id === id);

  const sheet = (target: CanvasRenderingContext2D, p: number, intro: number, ui: Ui): void => {
    const reg = input.reg;
    const t = easeInOut(span(p, CH.cut[0], XFADE[1]));
    const r = mix(bookRect(p, W, H), coverRect(reg, W, H), t);
    const cam = sheetCam(r);
    const kit = makeKit(target, input.pal, input.paper, dpr, penScale(cam));
    // Pointer parallax on the drawing, gone by the time the drawing has to register on the print.
    const pf = PARALLAX_PX * (1 - span(p, CH.cut[0], XFADE[0]));
    const off: V2 = [ui.parallax[0] * pf, ui.parallax[1] * pf];
    const base = (c: CanvasRenderingContext2D): void =>
      c.setTransform(dpr, 0, 0, dpr, off[0] * dpr, off[1] * dpr);
    target.save();
    base(target);
    const t1 = floor('T1');
    if (p < CH.axo[0]) {
      // 1-2: the drawing set; tầng 1 grows into the plate while the other three fade.
      const c1 = drawGroundFloor(kit, p, intro, W, H, r);
      if (t1 !== undefined) hits.plans.push({ cam: c1, floor: t1, off });
      const fade = 1 - span(p, SPREAD.zoom[0], SPREAD.zoom[0] + 0.02);
      if (fade >= 1) {
        drawOthers(kit, p, intro, W, H);
        miniCams(p, W, H).forEach((c, i) => {
          const f = FLOORS[i + 1];
          if (f !== undefined) hits.plans.push({ cam: c, floor: f, off });
        });
      } else if (fade > 0) {
        layer.setTransform(1, 0, 0, 1, 0, 0);
        layer.clearRect(0, 0, w, h);
        base(layer);
        drawOthers({ ...kit, ctx: layer }, p, intro, W, H);
        layer.setTransform(1, 0, 0, 1, 0, 0);
        target.setTransform(1, 0, 0, 1, 0, 0);
        target.globalAlpha = fade;
        target.drawImage(layer.canvas, 0, 0);
        target.globalAlpha = 1;
        base(target);
      }
    } else if (p < CH.axo[1]) {
      // 2b keeps the plan's pen scale (from `cam`) while its own camera tilts and frames the exploded stack.
      const ps = axoPose(span(p, CH.axo[0], CH.axo[1]));
      drawAxo(
        kit,
        axoCam(ps, r),
        ps,
        { section: sectionRect(W, H), from: flyFrom(W, H), lift: ui.lift },
        hits,
      );
    } else {
      if (reg.rot !== 0 && t > 0) {
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        target.translate(cx, cy);
        target.rotate(reg.rot * t);
        target.translate(-cx, -cy);
      }
      drawSheet(kit, cam, { d: 1, intro: 1, q: 1, under: 0 });
      if (t1 !== undefined && t === 0) hits.plans.push({ cam, floor: t1, off });
    }
    const room = ui.room;
    const hit = room === null ? undefined : hits.plans.find((q) => q.floor.id === room.level);
    if (room !== null && hit !== undefined)
      drawRoomHover({ ...kit, k: Math.max(0.8, kit.k) }, hit.cam, hit.floor, room);
    target.restore();
  };

  /** Nearest decoded frame (no neighbour cross-fade): one full-screen draw per sequence keeps p95 down on Intel UHD. */
  const seqAt = (seq: Seq | null, f: number, c: CanvasRenderingContext2D): boolean => {
    if (seq === null) return true;
    const img = seq.frame(f);
    if (img !== null) drawCover(c, img, img.width, img.height, w, h, 0.5);
    return seq.near(f, 0);
  };

  /**
   * The clay pass under the paint-in. Without B's clay frames the beauty frame stands in as is: the old greyed
   * stand-in (two full-screen composite passes) cost 60–240 ms a frame on Intel UHD and looked like a grey roof.
   */
  const clayAt = (f: number, c: CanvasRenderingContext2D): boolean =>
    seqAt(input.clay ?? input.b, f, c);

  const aFrame = (p: number): number =>
    input.a?.warp(span(p, A_RUN[0], A_RUN[1]), 0, input.a.count - 1, FLAT.a) ?? 0;
  const bridge = (): number => Math.max(1, input.b?.bridge ?? 1);
  /**
   * B's frame for story p: the bridge over chapter 5, then the exterior up to INSIDE_AT and the interior walk after
   * it, each on its own stretch of scroll (the interior path covers more ground per frame, so it gets more scroll).
   */
  const bFrame = (p: number): number => {
    const from = bridge() - 1;
    if (p < CH.walk[0]) return span(p, CH.real[0], CH.real[1]) * from;
    const last = (input.b?.count ?? 1) - 1;
    const at = input.b?.inside ?? 0;
    if (at <= from + 1) return from + span(p, CH.walk[0], CH.walk[1]) * (last - from);
    // int_0000 repeats the last exterior pose, so the exterior ends one frame before it.
    const b = input.b;
    if (b === null) return 0;
    if (p < INSIDE_AT) return b.warp(span(p, CH.walk[0], INSIDE_AT), from, at - 1, FLAT.exterior);
    return b.warp(span(p, INSIDE_AT, WALK_END), at, last, FLAT.walk);
  };


  /** 5: A's desk frame keeps pushing in and fades; under it the clay bridge, painted over from the entrance. */
  const realise = (p: number): boolean => {
    const u = span(p, CH.real[0], CH.real[1]);
    const f = bFrame(p);
    const xa = smooth(span(u, 0, 0.3));
    const t = smooth(span(u, 0.25, 0.95));
    let ok = true;
    if (t > 0) ok = seqAt(input.b, f, ctx);
    if (t < 1) {
      layer.setTransform(1, 0, 0, 1, 0, 0);
      layer.globalCompositeOperation = 'source-over';
      layer.clearRect(0, 0, w, h);
      ok = clayAt(f, layer) && ok;
      if (t > 0) {
        layer.globalCompositeOperation = 'destination-in';
        drawCover(layer, dissolve.update(t), dissolve.width, dissolve.height, w, h, 0.5);
        layer.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(layer.canvas, 0, 0);
    }
    const img = xa < 1 ? (input.a?.frame(input.a.count - 1) ?? null) : null;
    if (img !== null) {
      const z = 1 + 0.06 * xa;
      ctx.save();
      ctx.translate(w * ENTRANCE[0], h * ENTRANCE[1]);
      ctx.scale(z, z);
      ctx.translate(-w * ENTRANCE[0], -h * ENTRANCE[1]);
      drawCover(ctx, img, img.width, img.height, w, h, 0.5, 1 - xa);
      ctx.restore();
    }
    return ok;
  };

  const draw = (p: number, intro: number, ui: Ui): boolean => {
    hits = emptyHits();
    if (layer.canvas.width !== w || layer.canvas.height !== h) {
      layer.canvas.width = w;
      layer.canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    if (p >= CH.walk[0]) return seqAt(input.b, bFrame(p), ctx);
    if (p >= CH.real[0]) return realise(p);
    const x = smooth(span(p, XFADE[0], XFADE[1]));
    let ok = true;
    if (x > 0 && input.a !== null) {
      ctx.globalAlpha = x;
      ok = seqAt(input.a, aFrame(p), ctx);
      ctx.globalAlpha = 1;
    }
    if (x <= 0) sheet(ctx, p, intro, ui);
    else if (x < 1) {
      layer.setTransform(1, 0, 0, 1, 0, 0);
      layer.clearRect(0, 0, w, h);
      sheet(layer, p, intro, ui);
      ctx.globalAlpha = 1 - x;
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.globalAlpha = 1;
    }
    return ok;
  };

  const ready = (p: number): boolean => {
    const { a, b, clay } = input;
    if (p >= XFADE[0] && p < CH.real[0] && a !== null && !a.near(aFrame(p))) return false;
    if (p >= CH.real[0]) {
      if (p < CH.walk[0] && a !== null && !a.near(a.count - 1, 6)) return false;
      if (b !== null && !b.near(bFrame(p))) return false;
      if (p < CH.walk[0] && clay !== null && !clay.near(bFrame(p))) return false;
    }
    return true;
  };

  /**
   * Starts each sequence's trickle at its prefetch point. While the reader is actively scrolling through the
   * drawn chapters the trickle pauses (decodes compete with the canvas on Intel UHD); it runs when they stop to
   * read, and always once photographs are near.
   */
  const prefetch = (p: number, scrolling = false): void => {
    if (p >= NEEDS.a.prefetchAt) input.a?.start();
    if (p >= NEEDS.b.prefetchAt) {
      input.b?.start();
      input.clay?.start();
    }
    const hold = scrolling && p < NEEDS.a.from - 0.04;
    for (const s of [input.a, input.b, input.clay]) s?.pause(hold);
  };

  return { draw, ready, prefetch, hits: () => hits };
}
