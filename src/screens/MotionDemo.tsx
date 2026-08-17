import React from 'react';

import { STAGGER_BUDGET_MS, STAGGER_STEP_MS } from '@/lib/motion';

import { useMotionDemo, type DemoLayer, type MotionDemoScene } from '../hooks/useMotionDemo';

/**
 * Somewhere to actually watch the motion system work.
 *
 * `src/lib/motion` had no consumer: the orchestrator, the stagger and the
 * low-performance clamp were all covered by tests and none of them had ever put
 * a pixel on screen. This screen is that consumer — a scene handover, a
 * staggered list, and a switch that simulates R-04 reporting a struggling
 * machine so the durations can be seen collapsing.
 *
 * It renders only `opacity` and `transform`, which is the same constraint
 * `orchestrate.ts` enforces on its plans: animating a width or a top would make
 * the browser re-run layout on every frame.
 *
 * Every number shown is read from the motion module rather than written here,
 * so the caption cannot claim a timing the code does not use.
 */

const SCENE_LABELS: Readonly<Record<MotionDemoScene, string>> = {
  plan: 'mặt bằng 2D',
  model: 'mô hình 3D',
};

const KIND_LABELS: Readonly<Record<string, string>> = {
  view: 'đổi khung nhìn',
  screen: 'đổi màn',
  floor: 'đổi tầng',
};

const PHASE_LABELS: Readonly<Record<string, string>> = {
  idle: 'đứng yên',
  exit: 'đang ra',
  overlap: 'chồng nhau',
  enter: 'đang vào',
};

const chipClass = (active: boolean): string =>
  [
    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors duration-120',
    'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
    'focus-visible:ring-offset-bg-app',
    active ? 'bg-bg-selected text-accent' : 'bg-bg-sunken text-text-secondary hover:bg-bg-hover',
  ].join(' ');

function SceneLayer({ layer }: { layer: DemoLayer }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-xl border border-border-default bg-bg-surface"
      style={{
        opacity: layer.opacity,
        transform: `translateY(${layer.shiftPx}px)`,
      }}
    >
      <span className="text-[15px] font-medium text-text-primary">
        {SCENE_LABELS[layer.scene]}
      </span>
    </div>
  );
}

export function MotionDemo() {
  const demo = useMotionDemo();

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h2 className="text-[18px] font-semibold text-text-primary">Chuyển cảnh và nhịp</h2>
          <p className="text-[13px] text-text-secondary">
            Mọi thời lượng dưới đây đọc từ bảng nhịp chung; không con số nào viết thẳng ở màn này.
          </p>
        </header>

        {/* Điều kiện chuyển động */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[14px] font-medium text-text-primary">Điều kiện</h3>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={demo.toggleLowPerformance}
              aria-pressed={demo.lowPerformance}
              className={chipClass(demo.lowPerformance)}
            >
              Giả lập máy yếu
            </button>
            <span className="text-[13px] text-text-secondary">
              {demo.frameRate} khung hình/giây
              {demo.lowPerformance ? ' — dưới ngưỡng, mọi thời lượng về mức tức thì' : ''}
            </span>
          </div>
          {demo.reducedMotion ? (
            <p className="text-[13px] text-text-secondary">
              Hệ điều hành đang bật giảm chuyển động: mọi thời lượng bằng 0.
            </p>
          ) : null}
        </section>

        {/* Chuyển cảnh */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[14px] font-medium text-text-primary">Bàn giao cảnh</h3>
          <div className="flex flex-wrap gap-2">
            {demo.kinds.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => demo.setKind(kind)}
                aria-pressed={demo.kind === kind}
                className={chipClass(demo.kind === kind)}
              >
                {KIND_LABELS[kind] ?? kind}
              </button>
            ))}
          </div>

          <div className="relative h-[160px]">
            {demo.outgoing === null ? null : <SceneLayer layer={demo.outgoing} />}
            <SceneLayer layer={demo.incoming} />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={demo.swapScene}
              className={chipClass(false)}
            >
              Đổi cảnh
            </button>
            <span className="text-[13px] text-text-secondary" aria-live="polite">
              {PHASE_LABELS[demo.phase] ?? demo.phase} · tổng {demo.totalMs}ms · chồng{' '}
              {demo.overlapMs}ms
            </span>
          </div>
          <p className="text-[13px] text-text-secondary">
            Đổi cảnh giữa chừng sẽ thay thế lần đang chạy chứ không xếp hàng — thao tác không bao
            giờ phải chờ.
          </p>
        </section>

        {/* Trễ theo bậc */}
        <section className="flex flex-col gap-3">
          <h3 className="text-[14px] font-medium text-text-primary">Danh sách trễ theo bậc</h3>
          <div className="flex flex-wrap items-center gap-2">
            {demo.rowCounts.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => demo.setRowCount(count)}
                aria-pressed={demo.rowCount === count}
                className={chipClass(demo.rowCount === count)}
              >
                {count} mục
              </button>
            ))}
            <button type="button" onClick={demo.replayRows} className={chipClass(false)}>
              Chạy lại
            </button>
          </div>

          {demo.rows.length === 0 ? (
            <p className="rounded-xl border border-border-default bg-bg-surface px-4 py-6 text-center text-[13px] text-text-secondary">
              Chưa có mục nào.
            </p>
          ) : (
            <ul key={demo.replayKey} className="flex flex-col gap-1">
              {demo.rows.map((row) => (
                <li
                  key={row.index}
                  className="flex items-center justify-between rounded-lg border border-border-default bg-bg-surface px-3 py-2 animate-dropdown-open motion-reduce:animate-none"
                  style={{
                    animationDelay: `${row.delayMs}ms`,
                    animationDuration: `${row.durationMs}ms`,
                  }}
                >
                  <span className="text-[14px] text-text-primary">Mục {row.index + 1}</span>
                  <span className="font-mono text-[13px] text-text-secondary">
                    trễ {row.delayMs}ms
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[13px] text-text-secondary">
            Mỗi mục trễ thêm {STAGGER_STEP_MS}ms, ramp dừng lại nên trễ lâu nhất là{' '}
            {demo.maxRowDelayMs}ms — luôn dưới trần {STAGGER_BUDGET_MS}ms dù danh sách dài bao
            nhiêu. Mỗi mục tự vào trong {demo.rowDurationMs}ms.
          </p>
        </section>
      </div>
    </div>
  );
}
