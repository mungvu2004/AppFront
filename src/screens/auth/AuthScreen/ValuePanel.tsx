/**
 * The left column of `/login`: the drawing, the apartment standing on it, and
 * the two sentences beside them.
 *
 * A sibling file rather than part of `AuthScreen.tsx` because that view crossed
 * R-22's four-hundred-line ceiling once this went in, and CLAUDE.md section D
 * says what to do about it — split the piece out, keep `index.ts` as the door so
 * no caller has to follow. This is the cohesive piece to move: it is scenery
 * end to end. It takes no props, holds no state, reads nothing from the model
 * and can say nothing about whether anyone is signed in.
 */

import { useEffect, useRef } from 'react';

import viMessages from '@/i18n/vi.json';

import type { HouseSceneHandle } from './houseScene';

const AUTH_MESSAGES = viMessages.auth;

/**
 * The model, loaded only once the form is already on screen.
 *
 * three.js is by far the heaviest thing this route can pull, and `/login` is the
 * one page a signed-out visitor cannot get past — so it is imported at effect
 * time rather than at module time. The form paints, the fields are typeable, and
 * the flat arrives in its own chunk a moment later. Nobody waits on scenery to
 * sign in.
 *
 * The frame it sits in is painted `bg-scene-backdrop` by the panel, not by the
 * renderer alone: the chunk takes a moment, and a dark frame that appears dark
 * and then fills is one thing happening, where a pale frame that snaps dark is
 * a flash.
 *
 * The `cancelled` flag matters: a visitor who signs in quickly can unmount this
 * before the import settles, and mounting a WebGL context into a detached canvas
 * leaks it.
 */
function HouseModel() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null) {
      return undefined;
    }

    let cancelled = false;
    let handle: HouseSceneHandle | null = null;

    void import('./houseScene')
      .then((module) => {
        if (!cancelled) {
          handle = module.mountHouseScene(canvas);
        }
      })
      .catch(() => {
        // No WebGL context — an old browser, a blocklisted GPU, a headless run.
        // The panel keeps its dark frame and its two sentences, and signing in
        // is unaffected: this is scenery, and scenery that fails must fail
        // quietly rather than take the one screen a visitor cannot get past
        // with it.
      });

    return () => {
      cancelled = true;
      handle?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

/** Where the hairlines sit on the left panel. Static: nothing here moves or measures. */
const VERTICAL_RULE_OFFSETS = ['18%', '36%', '54%', '72%', '90%'] as const;
const HORIZONTAL_RULE_OFFSETS = ['28%', '64%'] as const;

/* -------------------------------------------------------------------------- */
/* The left column.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The value proposition: the drawing, and what the product makes out of one.
 *
 * The grid of hairlines is the drawing. The framed render standing on it is a
 * small flat — six rooms and a balcony — built by the product's own wall and
 * floor builders from `houseModel.json` and shown as an open box, the way a 3D
 * floor plan is shown. That is the whole pitch of the screen said without a
 * sentence. The frame is dark so the lit rooms stand out from the pale panel,
 * and it stays dark for anyone who asked motion to stop: the model then rests
 * at one angle rather than turning.
 *
 * `aria-hidden` on the rules and on the canvas because they are texture: a
 * screen reader that announced seven dividers before the form would be
 * describing the wallpaper.
 */
export function ValuePanel() {
  return (
    <section className="relative hidden w-[45%] shrink-0 overflow-hidden bg-bg-sunken p-12 lg:flex lg:flex-col lg:justify-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {VERTICAL_RULE_OFFSETS.map((offset) => (
          <span
            key={offset}
            className="absolute top-0 bottom-0 w-px bg-border-default"
            style={{ left: offset }}
          />
        ))}
        {HORIZONTAL_RULE_OFFSETS.map((offset) => (
          <span
            key={offset}
            className="absolute right-0 left-0 h-px bg-border-default"
            style={{ top: offset }}
          />
        ))}
      </div>

      <div className="relative flex flex-col gap-12">
        <div className="relative h-[400px] overflow-hidden rounded-2xl border border-border-default bg-scene-backdrop shadow-panel">
          <HouseModel />
        </div>

        <div className="flex max-w-[420px] flex-col gap-4 animate-panel-rise motion-reduce:animate-none">
          <h1 className="text-[28px] font-semibold leading-[36px] text-text-primary">
            {AUTH_MESSAGES.hero.headline}
          </h1>
          <p className="text-[15px] leading-[24px] text-text-secondary">
            {AUTH_MESSAGES.hero.support}
          </p>
        </div>
      </div>
    </section>
  );
}
