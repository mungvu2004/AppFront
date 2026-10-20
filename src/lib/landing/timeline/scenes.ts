/**
 * The nine scenes of the storyboard (PROMPTS.md, Prompt 3) as scroll intervals.
 *
 * Authored in screens, not p: a scene starts when the camera leaves the shot
 * before the first key marked with its id (shots.ts), so the intervals follow
 * the budget-timed schedule and `SCENES` is derived (p = screens / TRACK_SCREENS).
 * Intervals tile [0, 1] with no gaps so `sceneAt` always has an owner; the
 * animation itself overlaps neighbouring scenes freely (state.ts) — a scene
 * boundary is where the copy changes, not where motion stops.
 */

import { TRACK_SCREENS, WAYPOINTS } from './camera';
import { clamp01 } from './rig';

export { clamp01 } from './rig';

export interface SceneSpec {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly title: string;
}

const TITLES: readonly (readonly [string, string])[] = [
  ['s01', 'Bản vẽ biết trở thành ngôi nhà.'],
  ['s02', 'Từ bản vẽ đến hình học có thể đo lường.'],
  ['s03', 'AI nhận diện. Hình học bắt đầu có ý nghĩa.'],
  ['s04', 'Bạn kiểm tra. Bạn quyết định.'],
  ['s05', 'Từ nét vẽ. Thành không gian thật.'],
  // The brief gives S06 room labels but no headline; this one is ours (SCREEN may drop it).
  ['s06', 'Đi qua từng không gian.'],
  ['s07', 'Hai tầng. Một mô hình thống nhất.'],
  ['s08', 'Không chỉ dựng hình. Còn giúp phát hiện vấn đề.'],
  ['s09', 'Bản vẽ của bạn. Bắt đầu một công trình mới.'],
];

/** Screen time each scene starts: leaving the waypoint before its first marked key. */
export const SCENE_SCREENS: readonly number[] = TITLES.map(([id], k) => {
  if (k === 0) return 0;
  const i = WAYPOINTS.findIndex((w) => w.scene === id);
  if (i < 1) throw new RangeError(`no shot starts scene ${id}`);
  return (WAYPOINTS[i - 1] as { screen: number }).screen;
});

/** Screen time scene `id` starts. */
export const sceneStart = (id: string): number => SCENE_SCREENS[TITLES.findIndex(([x]) => x === id)] ?? 0;

export const SCENES: readonly SceneSpec[] = TITLES.map(([id, title], k) => ({
  id,
  title,
  start: (SCENE_SCREENS[k] as number) / TRACK_SCREENS,
  end: k + 1 < TITLES.length ? (SCENE_SCREENS[k + 1] as number) / TRACK_SCREENS : 1,
}));

/** The scene that owns `p` (the later one on a boundary) and how far through it `p` is. */
export function sceneAt(p: number): { scene: number; sceneLocal: number } {
  const q = clamp01(p);
  let scene = SCENES.findIndex((s) => q < s.end);
  if (scene < 0) {
    scene = SCENES.length - 1;
  }
  const s = SCENES[scene] as SceneSpec;
  return { scene, sceneLocal: (q - s.start) / (s.end - s.start) };
}
