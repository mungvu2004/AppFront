/**
 * Route /welcome: chọn giữa bản cuộn (ghim + canvas) và bản tĩnh.
 * Tĩnh khi người dùng giảm chuyển động, không có WebGL2 hay context bị mất;
 * ngược lại cuộn, với canvas nạp sau khung hình đầu.
 */

import { useCallback, useRef, useState } from 'react';
import { useNavigationType } from 'react-router-dom';

import { ScreenErrorBoundary } from '@/components/feedback/ScreenErrorBoundary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SCENES, TRACK_SCREENS } from '@/lib/landing/timeline';
import type { LandingHouse } from '@/lib/landing/types';

import { ENTER } from './landing.copy';
import { LandingView } from './LandingView';
import { stepStartP } from './overlay';
import { StaticLanding } from './StaticLanding';
import { useLandingScroll } from './useLandingScroll';
// Gói thành chuỗi trong chunk của route: cổng CSS tính theo tệp .css, mà chunk route còn dư chỗ.
import landingCss from './landing.css?inline';

const SCENE_IDS = SCENES.map((s) => s.id);
/** Đoạn cuộn: TRACK_SCREENS màn cho p 0→1 cộng một màn ghim (start 'top top', end 'bottom bottom'). */
const TRACK_VH = TRACK_SCREENS + 1;

function LandingContent() {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [house, setHouse] = useState<LandingHouse | null>(null);
  const track = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const skipRef = useRef<(() => void) | null>(null);
  const pinned = !reduced && !failed;
  const restore = useNavigationType() === 'POP';

  useLandingScroll({
    enabled: pinned,
    track,
    stickyRoot: sticky,
    canvas,
    skipRef,
    restore,
    onReady: setHouse,
    onFallback: useCallback(() => setFailed(true), []),
  });

  if (!pinned) {
    return <StaticLanding />;
  }

  // ponytail: cuộn thẳng tới vị trí của p; thay bằng seekToScene(i) của useLandingScroll khi PERF-V thêm nó.
  const onStep = (step: number): void => {
    const el = track.current;
    if (el === null) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const p = stepStartP(step, SCENES, ENTER);
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * p });
  };

  return (
    <LandingView
      trackVh={TRACK_VH}
      sceneIds={SCENE_IDS}
      house={house}
      onStep={onStep}
      onSkip={() => {
        skipRef.current?.();
        // Nút hiện sau khi khung kế tiếp vẽ xong; focus sớm hơn sẽ trượt vì nó còn ẩn.
        requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('bat-dau')?.focus()));
      }}
      refs={{ track, sticky, canvas }}
    />
  );
}

/** Nếu bản cuộn sập, người xem vẫn có bản tĩnh với nút bắt đầu. */
export function LandingRoute() {
  return (
    <>
      <style>{landingCss}</style>
      <ScreenErrorBoundary screenId="landing" renderFallback={() => <StaticLanding />}>
        <LandingContent />
      </ScreenErrorBoundary>
    </>
  );
}
