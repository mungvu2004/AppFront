/**
 * `stateAt(p)`: everything except the camera, from ONE paused GSAP timeline.
 *
 * The timeline (choreo.ts) is authored in SCREENS (total duration TRACK_SCREENS)
 * and anchored to the camera's budget-timed waypoints, so the build stays in
 * step with the shots whatever the schedule gives them. It tweens a plain
 * mutable object; each call seeks it to `p × TRACK_SCREENS` and copies the
 * object into a fresh frozen `LandingState`. Every tween is a `fromTo` with
 * explicit values and `immediateRender: false`, and two tweens on the same
 * property may never overlap (the builder throws) — that is what makes seeking
 * order-independent: any p reached from any previous p gives the same values.
 */

import type { LandingState } from '../types';

import { cameraAt, TRACK_SCREENS } from './camera';
import { blank, build, FURNITURE_GROUP } from './choreo';
import { DEFAULT_ASPECT } from './framing';
import { clamp01, sceneAt } from './scenes';

export { FURNITURE_GROUP } from './choreo';
export { furnitureSettle } from './recipes';

export function furnitureRise(state: LandingState, id: string): number {
  return state.build.furniture[id] ?? state.build.furniture[FURNITURE_GROUP] ?? 0;
}

const live = blank();
const TL = build(live);

/** GSAP parks its cache (`_gsap`) on every target, so copy the numbers only. */
const freeze = <T extends object>(x: T): Readonly<T> =>
  Object.freeze(Object.fromEntries(Object.entries(x).filter(([, v]) => typeof v === 'number')) as T);

/** Everything at scroll `p`; `aspect` (width / height) only changes the camera's framing. */
export function stateAt(p: number, aspect: number = DEFAULT_ASPECT): LandingState {
  const q = clamp01(p);
  TL.time(q * TRACK_SCREENS);
  const { scene, sceneLocal } = sceneAt(q);
  const cam = cameraAt(q, aspect);
  return Object.freeze({
    p: q,
    scene,
    sceneLocal,
    camera: Object.freeze({ ...cam, position: Object.freeze(cam.position), target: Object.freeze(cam.target) }),
    paper: freeze(live.paper),
    detect: freeze(live.detect),
    review: freeze(live.review),
    build: Object.freeze({ ...freeze(live.build), wallRise: freeze(live.wallRise), furniture: freeze(live.furniture) }),
    compliance: freeze(live.compliance),
    exports: live.misc.exports,
    semantic: live.misc.semantic,
    labels: freeze(live.labels),
  });
}
