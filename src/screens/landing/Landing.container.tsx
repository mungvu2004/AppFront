/**
 * Route /welcome: chọn giữa bản cuộn (ghim + canvas) và bản tĩnh.
 * Tĩnh khi người dùng giảm chuyển động, không có WebGL2 hay context bị mất;
 * ngược lại cuộn, với canvas nạp sau khung hình đầu.
 */

import { useCallback, useRef, useState } from 'react';
import { useNavigationType } from 'react-router-dom';

import { ScreenErrorBoundary } from '@/components/feedback/ScreenErrorBoundary';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { SCENES } from '@/lib/landing/timeline';
import type { LandingHouse } from '@/lib/landing/types';

import { LandingView } from './LandingView';
import { StaticLanding } from './StaticLanding';
import { useLandingScroll } from './useLandingScroll';
// Gói thành chuỗi trong chunk của route: cổng CSS tính theo tệp .css, mà chunk route còn dư chỗ.
import landingCss from './landing.css?inline';

const TOTAL = (SCENES[SCENES.length - 1]?.end ?? 1) - (SCENES[0]?.start ?? 0);
/** Chiều cao đoạn cuộn tính bằng "số màn" ở bề ngang desktop; CSS rút lại ở tablet. */
const TRACK_SCREENS = 10;

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

  const suggestions = house?.checks.flatMap((c) => (!c.pass && c.suggestion !== undefined ? [c.suggestion] : []));

  return (
    <LandingView
      trackVh={TOTAL * TRACK_SCREENS}
      lastScene={SCENES.length - 1}
      loading={house === null}
      suggestions={suggestions !== undefined && suggestions.length > 0 ? suggestions : undefined}
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
