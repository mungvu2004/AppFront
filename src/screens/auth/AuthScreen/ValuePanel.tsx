/**
 * The left column of `/login`: the drawing, the model standing on it, and the
 * two sentences beside them.
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
 * the house arrives in its own chunk a moment later. Nobody waits on scenery to
 * sign in.
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
        // The panel keeps its grid and its two sentences, and signing in is
        // unaffected: this is scenery, and scenery that fails must fail quietly
        // rather than take the one screen a visitor cannot get past with it.
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
/* The model on the left panel.                                                */
/* -------------------------------------------------------------------------- */

/**
 * A wireframe volume, turning slowly, drawn with CSS transforms alone.
 *
 * The panel already had a flat grid of hairlines on it — the drawing. This is
 * what the product makes *out of* a drawing, standing on top of it, which is the
 * whole pitch of the screen said without a sentence.
 *
 * Three constraints shaped it, and each one ruled something out:
 *
 * - **No three.js, no framer-motion, no library at all.** The bundle is already
 *   over its gzip budget, and a WebGL scene on the one route a signed-out
 *   visitor must load would be the worst possible place to spend the overage.
 *   Six absolutely-positioned elements under `preserve-3d` cost nothing.
 * - **No accent colour.** Invariant A2 reserves it for things you can operate,
 *   and this is scenery. Hairline borders only, the same token the grid uses.
 * - **It stops for anyone who asked it to.** `motion-reduce:animate-none` —
 *   a shape rotating forever in peripheral vision is exactly what that setting
 *   exists to switch off.
 */


/* -------------------------------------------------------------------------- */
/* The left column.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The value proposition, on a grid that is drawn rather than rendered.
 *
 * `aria-hidden` on the rules because they are texture: a screen reader that
 * announced seven dividers before the form would be describing the wallpaper.
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
        <div className="relative h-[400px]">
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
