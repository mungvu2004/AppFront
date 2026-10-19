/**
 * Tab "Trực quan", chế độ mặc định: mặt bằng 2D của tầng, vẽ chồng hai bản (G5-21, N3-04).
 *
 * VIEW THUẦN (R-60): nhận `PlanDiffModel` đã nấu sẵn (`versionHistoryPlan.ts`), không tự so dữ
 * liệu. Màu chỉ đi qua `DIFF_TONE_TOKENS` và token (A1/A4). Không chỉ dựa vào màu (WCAG 1.4.1):
 * thêm = nét liền, xoá = nét đứt, sửa = nét chấm, cả trên hình lẫn trong chú giải.
 *
 * Hình trên SVG không nằm trong vòng Tab, cùng lý do `ThicknessPreviewCanvas.tsx`: bàn phím đi
 * qua danh sách thay đổi bên dưới; trỏ/bấm hình chỉ là lối tắt cho chuột.
 */

import { formatNumber } from '@/lib/format/number';

import { DIFF_TONE_TOKENS } from './types';
import type { DiffTone, PlanDiffModel, PlanDiffShape, PlanTone } from './types';

const SVG_LABEL_PREFIX = 'Mặt bằng ';
const LEGEND_LABEL = 'Chú giải mặt bằng';
const SAME_LABEL = 'Không đổi';
const NO_PLAN_TEXT =
  'Chưa vẽ được mặt bằng vì một trong hai bản chưa có ảnh chụp. Danh sách thay đổi bên dưới vẫn đủ.';
const EMPTY_PLAN_TEXT = 'Tầng này chưa có tường, phòng hay đồ đạc nào ở cả hai bản, nên không có gì để vẽ.';
const HINT_TEXT = 'Bấm một hình hoặc một dòng để ghim; bấm lại hoặc nhấn Esc để bỏ ghim.';

/** Mẫu nét theo px màn hình (đi cùng `non-scaling-stroke`). `undefined` = nét liền. */
const TONE_DASH: Readonly<Record<DiffTone, string | undefined>> = {
  added: undefined,
  removed: '8 5',
  changed: '1 5',
};

const IDLE = 'var(--wall-idle)';
const ACCENT = 'var(--accent)';
const OUTLINE_PX = 2;
const OPENING_PX = 5;
/** Thân tường tô nhạt để nét trục (mẫu nét) nổi lên trên. */
const BODY_OPACITY = 0.35;
/** Có hình đang nổi thì mọi hình khác mờ đi. */
const DIM_OPACITY = 0.25;
const FOCUS_HALO_MM = 160;
const FURNITURE_R_MM = 250;
/** Cỡ chữ nhãn phòng = cạnh dài của khung / hệ số này (khung tính bằng mm). */
const LABEL_SCALE = 60;

const colorOf = (tone: PlanTone): string => (tone === 'same' ? IDLE : DIFF_TONE_TOKENS[tone]);
const dashOf = (tone: PlanTone): string | undefined => (tone === 'same' ? undefined : TONE_DASH[tone]);

function centroidOf(points: string): { x: number; y: number } {
  const pairs = points.split(' ').map((pair) => pair.split(',').map(Number));
  const sum = pairs.reduce((acc, [x = 0, y = 0]) => ({ x: acc.x + x, y: acc.y + y }), { x: 0, y: 0 });

  return { x: sum.x / (pairs.length || 1), y: sum.y / (pairs.length || 1) };
}

export interface VersionPlanDiffProps {
  readonly plan: PlanDiffModel | null;
  /** `actions.hoverDiffRow`. */
  readonly onHover: (entityId: string | null) => void;
  /** `actions.pinDiffRow` — bấm hình thì ghim dòng tương ứng. */
  readonly onPick: (entityId: string) => void;
}

export function VersionPlanDiff({ plan, onHover, onPick }: VersionPlanDiffProps) {
  if (plan === null) {
    return (
      <p className="rounded-lg border border-border-default bg-bg-surface p-4 text-[14px] text-text-secondary">
        {NO_PLAN_TEXT}
      </p>
    );
  }

  const shapes: readonly PlanDiffShape[] = [...plan.walls, ...plan.rooms, ...plan.openings, ...plan.furniture];
  if (shapes.length === 0) {
    return (
      <p className="rounded-lg border border-border-default bg-bg-surface p-4 text-[14px] text-text-secondary">
        {EMPTY_PLAN_TEXT}
      </p>
    );
  }

  const anyFocused = shapes.some((shape) => shape.focused);
  const [, , boxW = 1, boxH = 1] = plan.viewBox.split(' ').map(Number);
  const labelSize = Math.max(boxW, boxH) / LABEL_SCALE;

  const groupProps = (shape: PlanDiffShape) => ({
    'data-entity-id': shape.id,
    'data-tone': shape.tone,
    'data-focused': shape.focused ? 'true' : undefined,
    opacity: anyFocused && !shape.focused ? DIM_OPACITY : 1,
    ...(shape.tone === 'same'
      ? {}
      : {
          className: 'cursor-pointer',
          onPointerEnter: () => onHover(shape.id),
          onPointerLeave: () => onHover(null),
          onClick: () => onPick(shape.id),
        }),
  });

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <ul aria-label={LEGEND_LABEL} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {plan.legend.map((item) => (
            <li key={item.tone} data-legend-tone={item.tone} className="inline-flex items-center gap-1.5">
              <LegendSwatch color={DIFF_TONE_TOKENS[item.tone]} dash={TONE_DASH[item.tone]} />
              <span className="text-[13px] text-text-primary">
                {item.label + ': ' + formatNumber(item.count, { fractionDigits: 0 })}
              </span>
            </li>
          ))}
          <li className="inline-flex items-center gap-1.5">
            <LegendSwatch color={IDLE} dash={undefined} />
            <span className="text-[13px] text-text-secondary">{SAME_LABEL}</span>
          </li>
        </ul>
        <span className="text-[12px] text-text-tertiary">{HINT_TEXT}</span>
      </figcaption>
      <svg
        role="img"
        aria-label={SVG_LABEL_PREFIX + plan.floorLabel}
        viewBox={plan.viewBox}
        className="h-[clamp(260px,50vh,480px)] w-full shrink-0 rounded-lg border border-border-default bg-bg-sunken"
      >
        {plan.rooms.map((room) => {
          const c = centroidOf(room.points);

          return (
            <g key={'r-' + room.id} {...groupProps(room)}>
              <polygon
                points={room.points}
                fill={room.tone === 'same' ? 'none' : colorOf(room.tone)}
                fillOpacity={0.08}
                stroke={room.tone === 'same' ? 'var(--border-default)' : colorOf(room.tone)}
                strokeWidth={room.focused ? OUTLINE_PX * 2 : 1}
                strokeDasharray={dashOf(room.tone)}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={c.x}
                y={c.y}
                fontSize={labelSize}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="var(--text-secondary)"
                pointerEvents="none"
              >
                {room.label}
              </text>
            </g>
          );
        })}

        {plan.walls.map((wall) => {
          const line = { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 };

          return (
            <g key={'w-' + wall.id} {...groupProps(wall)}>
              {wall.focused ? (
                <line {...line} stroke={ACCENT} strokeWidth={wall.thickness + FOCUS_HALO_MM} strokeLinecap="square" />
              ) : null}
              <line
                {...line}
                stroke={colorOf(wall.tone)}
                strokeWidth={wall.thickness}
                strokeOpacity={wall.tone === 'same' ? 1 : BODY_OPACITY}
                strokeLinecap="square"
              />
              {wall.tone === 'same' ? null : (
                <line
                  {...line}
                  stroke={colorOf(wall.tone)}
                  strokeWidth={OUTLINE_PX}
                  strokeDasharray={dashOf(wall.tone)}
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          );
        })}

        {plan.openings.map((opening) => (
          <g key={'o-' + opening.id} {...groupProps(opening)}>
            <line
              x1={opening.x1}
              y1={opening.y1}
              x2={opening.x2}
              y2={opening.y2}
              stroke={opening.tone === 'same' ? 'var(--bg-surface)' : colorOf(opening.tone)}
              strokeWidth={opening.focused ? OPENING_PX * 2 : OPENING_PX}
              strokeDasharray={dashOf(opening.tone)}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}

        {plan.furniture.map((item) => (
          <g key={'f-' + item.id} {...groupProps(item)}>
            <circle
              cx={item.x}
              cy={item.y}
              r={FURNITURE_R_MM}
              fill="none"
              stroke={item.focused ? ACCENT : colorOf(item.tone)}
              strokeWidth={OUTLINE_PX}
              strokeDasharray={dashOf(item.tone)}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </svg>

    </figure>
  );
}

function LegendSwatch({ color, dash }: { readonly color: string; readonly dash: string | undefined }) {
  return (
    <svg aria-hidden="true" width={24} height={8} className="shrink-0">
      <line x1={2} y1={4} x2={22} y2={4} stroke={color} strokeWidth={3} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}
