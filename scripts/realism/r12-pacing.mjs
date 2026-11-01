/**
 * R12: frame-limiter vẽ theo nhịp màn (bội số chu kỳ rAF) thay vì đồng hồ 50 FPS lệch nhịp.
 * Logic ở `src/pascal-page/realism/pacing.ts`.
 */
export const RULES = {
  'viewer/src/components/viewer/frame-limiter.tsx': [
    [
      "import useViewer from '../../store/use-viewer'\n",
      "import useViewer from '../../store/use-viewer'\nimport { createVsyncClock } from '@pascal-realism/pacing'\n",
    ],
    ['    const clock = createFrameClock(nextFrameTimeRef.current)\n', '    const clock = createVsyncClock(nextFrameTimeRef.current)\n'],
  ],
};
