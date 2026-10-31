/**
 * Ba thứ học từ SketchUp cho lúc vẽ (AppFront, không sửa `vendor/pascal`):
 * 1. Gõ chiều dài khi đang kéo tường, Enter là dựng đúng số đó (`commitPoint.ts`).
 * 2. Nhãn chữ cạnh con trỏ khi điểm bị hút vào góc/trung điểm/giao điểm/thân tường hoặc thẳng hàng.
 * 3. `ToolHint`: một dòng "bước tiếp theo" cho công cụ đang cầm, đặt trong cột giữa của `CanvasHelp`.
 */
import { emitter, type GridEvent } from '@pascal-app/core';
import { useAlignmentGuides, useEditor, useFloorplanDraftPreview, useWallSnapIndicator } from '@pascal-app/editor';
import { useViewer } from '@pascal-app/viewer';
import { useEffect, useRef, useState } from 'react';

import { formatLength } from '@/lib/format/measure';

import { commitWallPoint } from './commitPoint';
import { nextTypedBuffer, parseTypedLength, pointAtLength, snapLabelOf, toolHintOf } from './typedLength';

const MM_PER_M = 1000;
const CHIP_OFFSET_PX = 18;

function useWallDrafting(): boolean {
  const wallTool = useEditor((s) => s.mode === 'build' && s.tool === 'wall');
  const started = useFloorplanDraftPreview((s) => s.wallDraftStart !== null);
  return wallTool && started;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

function usePointer(): [number, number] | null {
  const [pointer, setPointer] = useState<[number, number] | null>(null);
  useEffect(() => {
    const onMove = (event: PointerEvent) => setPointer([event.clientX, event.clientY]);
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  return pointer;
}

/** Ô gõ chiều dài: bắt phím ở pha capture để phím số không lọt xuống phím tắt của editor. */
function useTypedLength(active: boolean, notation: 'meters' | 'millimeters'): string {
  const [buffer, setBuffer] = useState('');
  const lastMove = useRef<GridEvent | null>(null);

  useEffect(() => {
    const onMove = (event: GridEvent) => {
      lastMove.current = event;
    };
    emitter.on('grid:move', onMove);
    return () => emitter.off('grid:move', onMove);
  }, []);

  useEffect(() => {
    if (!active) setBuffer('');
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      if (buffer !== '' && (event.key === 'Escape' || event.key === 'Enter')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Enter') commitTyped(buffer, notation, lastMove.current);
        setBuffer('');
        return;
      }
      const next = nextTypedBuffer(buffer, event.key);
      if (next === null) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setBuffer(next);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, buffer, notation]);

  return buffer;
}

function commitTyped(buffer: string, notation: 'meters' | 'millimeters', lastMove: GridEvent | null): void {
  const typed = parseTypedLength(buffer, notation);
  const { wallDraftStart, wallDraftEnd } = useFloorplanDraftPreview.getState();
  if (!typed || !wallDraftStart || !wallDraftEnd) return;
  const end = pointAtLength(wallDraftStart, wallDraftEnd, typed.mm / MM_PER_M);
  if (end) commitWallPoint(end, lastMove);
}

/** Chip cạnh con trỏ: số đang gõ (ưu tiên), hoặc tên điểm vừa bị hút vào. */
export function DraftAssist() {
  const drafting = useWallDrafting();
  const metric = useViewer((s) => s.unit === 'metric');
  const notation = useViewer((s) => s.metricNotation);
  const buffer = useTypedLength(drafting && metric, notation);
  const snapKind = useWallSnapIndicator((s) => s.point?.kind ?? null);
  const aligned = useAlignmentGuides((s) => s.guides.length > 0);
  const building = useEditor((s) => s.mode === 'build');
  const pointer = usePointer();

  const typed = buffer === '' ? null : parseTypedLength(buffer, notation);
  const text =
    buffer !== ''
      ? `${buffer}${typed ? ` = ${formatLength(typed.mm)}` : ''} · Enter để dựng`
      : building
        ? snapLabelOf(snapKind, aligned)
        : null;
  if (!text || !pointer) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed z-50 whitespace-nowrap rounded-full border border-border/60 bg-background/90 px-2.5 py-0.5 text-foreground text-xs tabular-nums shadow-sm backdrop-blur"
      data-testid="draft-assist-chip"
      style={{ left: pointer[0] + CHIP_OFFSET_PX, top: pointer[1] + CHIP_OFFSET_PX }}
    >
      {text}
    </div>
  );
}

/** Dòng "bước tiếp theo" cho công cụ đang cầm (SketchUp: thanh trạng thái). */
export function ToolHint() {
  const mode = useEditor((s) => s.mode);
  const tool = useEditor((s) => s.tool);
  const wallDrafting = useFloorplanDraftPreview((s) => s.wallDraftStart !== null);
  const hint = toolHintOf({ mode, tool, wallDrafting });
  if (!hint) return null;
  return (
    <div
      className="pointer-events-none rounded-full border border-border/60 bg-background/90 px-4 py-1.5 text-foreground text-sm shadow-sm backdrop-blur"
      data-testid="tool-hint"
      role="status"
    >
      {hint}
    </div>
  );
}
