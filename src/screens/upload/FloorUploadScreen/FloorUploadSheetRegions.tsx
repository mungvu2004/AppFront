/**
 * "Một tờ nhiều tầng" — khoanh vùng từng tầng trên một tờ. Chỉ vẽ; khung và chữ đến từ
 * `useSheetRegions.ts`. Kéo trên ảnh để vẽ khung của tầng đang chọn, kéo trong khung để dời,
 * phím mũi tên dời khung đang chọn, Esc đóng bảng.
 */

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/Button';
import { clampRatio, percentOf } from '@/screens/upload/InputQualityGate/InputQualityGateImageGeometry';

import { moveRect, rectFromPoints, type SheetPoint } from './useSheetRegions';
import type { FloorUploadActions, FloorUploadSheetRect, FloorUploadSheetRegionsModel } from './types';

const NUDGE = 0.01;

const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-NUDGE, 0],
  ArrowRight: [NUDGE, 0],
  ArrowUp: [0, -NUDGE],
  ArrowDown: [0, NUDGE],
};

export interface FloorUploadSheetRegionsProps {
  readonly model: FloorUploadSheetRegionsModel | null | undefined;
  readonly actions: Pick<
    FloorUploadActions,
    'onSelectSheetFloor' | 'onSetSheetRegion' | 'onConfirmSheetRegions' | 'onCloseSheetRegions'
  >;
}

interface Drag { readonly kind: 'draw' | 'move'; readonly start: SheetPoint; readonly base: FloorUploadSheetRect | null }

const inside = (rect: FloorUploadSheetRect | null, point: SheetPoint): boolean =>
  rect !== null &&
  point.xRatio >= rect.xRatio &&
  point.xRatio <= rect.xRatio + rect.widthRatio &&
  point.yRatio >= rect.yRatio &&
  point.yRatio <= rect.yRatio + rect.heightRatio;

export function FloorUploadSheetRegions({ actions, model }: FloorUploadSheetRegionsProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [live, setLive] = useState<FloorUploadSheetRect | null>(null);

  if (model == null) return null;

  const selected = model.floors.find((floor) => floor.floorId === model.selectedFloorId) ?? null;

  const ratioAt = (event: PointerEvent<HTMLDivElement>): SheetPoint | null => {
    const bounds = frameRef.current?.getBoundingClientRect();

    if (bounds === undefined || bounds.width === 0 || bounds.height === 0) return null;

    return {
      xRatio: clampRatio((event.clientX - bounds.left) / bounds.width),
      yRatio: clampRatio((event.clientY - bounds.top) / bounds.height),
    };
  };

  const next = (point: SheetPoint, current: Drag): FloorUploadSheetRect =>
    current.kind === 'move' && current.base !== null
      ? moveRect(current.base, point.xRatio - current.start.xRatio, point.yRatio - current.start.yRatio)
      : rectFromPoints(current.start, point);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    const point = ratioAt(event);

    if (point === null || selected === null) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ kind: inside(selected.rect, point) ? 'move' : 'draw', start: point, base: selected.rect });
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const point = drag === null ? null : ratioAt(event);

    if (drag !== null && point !== null) setLive(next(point, drag));
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const point = ratioAt(event);

    if (drag !== null && point !== null && selected !== null) {
      actions.onSetSheetRegion?.(selected.floorId, next(point, drag));
    }
    setDrag(null);
    setLive(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') {
      actions.onCloseSheetRegions?.();
      return;
    }

    const delta = ARROWS[event.key];

    if (delta !== undefined && selected?.rect != null && event.target === frameRef.current) {
      event.preventDefault();
      actions.onSetSheetRegion?.(selected.floorId, moveRect(selected.rect, delta[0], delta[1]));
    }
  };

  return (
    <section
      aria-labelledby="floor-upload-sheet-title"
      className="flex flex-col gap-3 rounded-lg border border-border-default bg-bg-sunken p-4"
      data-testid="floor-upload-sheet-regions"
      onKeyDown={onKeyDown}
    >
      <header className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-heading text-text-primary" id="floor-upload-sheet-title">
          {model.title}
        </h3>
        <Button className="ml-auto" onClick={actions.onCloseSheetRegions} size="sm" type="button" variant="ghost">
          {model.closeLabel}
        </Button>
      </header>
      <p className="text-body-sm text-text-secondary">{model.hint}</p>

      <div aria-label="Tầng cần khoanh" className="flex flex-wrap gap-2" role="radiogroup">
        {model.floors.map((floor) => (
          <Button
            aria-checked={floor.floorId === model.selectedFloorId}
            key={floor.floorId}
            onClick={() => actions.onSelectSheetFloor?.(floor.floorId)}
            role="radio"
            size="sm"
            type="button"
            variant={floor.floorId === model.selectedFloorId ? 'primary' : 'secondary'}
          >
            {floor.note === null ? floor.name : `${floor.name} · ${floor.note}`}
          </Button>
        ))}
      </div>

      <div
        aria-label={selected === null ? 'Ảnh tờ bản vẽ' : `Khoanh vùng của ${selected.name}`}
        className="relative w-full cursor-crosshair touch-none select-none overflow-hidden rounded-lg bg-bg-surface"
        data-testid="floor-upload-sheet-frame"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        ref={frameRef}
        role="application"
        tabIndex={0}
      >
        <img alt="" className="block h-auto w-full" draggable={false} src={model.previewUrl} />
        {model.floors.map((floor) => {
          const rect = floor.floorId === selected?.floorId && live !== null ? live : floor.rect;

          return rect === null ? null : (
            <div
              className={clsx(
                'pointer-events-none absolute border-2',
                floor.floorId === model.selectedFloorId ? 'border-accent' : 'border-border-default',
              )}
              data-testid={`floor-upload-sheet-rect-${floor.floorId}`}
              key={floor.floorId}
              style={{
                left: percentOf(rect.xRatio),
                top: percentOf(rect.yRatio),
                width: percentOf(rect.widthRatio),
                height: percentOf(rect.heightRatio),
              }}
            >
              <span className="absolute left-0 top-0 rounded-br bg-bg-surface px-1 text-caption text-text-primary">
                {floor.name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!model.canConfirm}
          onClick={actions.onConfirmSheetRegions}
          type="button"
          variant="primary"
        >
          {model.confirmLabel}
        </Button>
      </div>
    </section>
  );
}
