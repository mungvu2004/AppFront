/**
 * The nine scenes of the storyboard (PROMPTS.md, Prompt 3) as scroll intervals.
 *
 * Intervals tile [0, 1] with no gaps so `sceneAt` always has an owner; the
 * animation itself overlaps neighbouring scenes freely (state.ts) — a scene
 * boundary is where the copy changes, not where motion stops.
 */

export interface SceneSpec {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly title: string;
}

export const SCENES: readonly SceneSpec[] = [
  { id: 's01', start: 0, end: 0.08, title: 'Bản vẽ biết trở thành ngôi nhà.' },
  { id: 's02', start: 0.08, end: 0.18, title: 'Từ bản vẽ đến hình học có thể đo lường.' },
  { id: 's03', start: 0.18, end: 0.3, title: 'AI nhận diện. Hình học bắt đầu có ý nghĩa.' },
  { id: 's04', start: 0.3, end: 0.4, title: 'Bạn kiểm tra. Bạn quyết định.' },
  { id: 's05', start: 0.4, end: 0.55, title: 'Từ nét vẽ. Thành không gian thật.' },
  // The brief gives S06 room labels but no headline; this one is ours (SCREEN may drop it).
  { id: 's06', start: 0.55, end: 0.68, title: 'Đi qua từng không gian.' },
  { id: 's07', start: 0.68, end: 0.78, title: 'Hai tầng. Một mô hình thống nhất.' },
  { id: 's08', start: 0.78, end: 0.88, title: 'Không chỉ dựng hình. Còn giúp phát hiện vấn đề.' },
  { id: 's09', start: 0.88, end: 1, title: 'Bản vẽ của bạn. Bắt đầu một công trình mới.' },
];

export const clamp01 = (p: number): number => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0);

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
