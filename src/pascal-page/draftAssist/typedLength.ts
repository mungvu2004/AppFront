/**
 * Gõ số khi đang vẽ (kiểu ô "Measurements" của SketchUp): đang kéo tường thì gõ `3500` rồi Enter là ra
 * đúng 3,5 m theo hướng con trỏ. Tầng thuần — không React, không Pascal — để test được bằng số.
 */
import { parseNumber } from '@/lib/format/number';

export type TypedUnit = 'mm' | 'cm' | 'm';
export type PlanPoint = readonly [number, number];

export interface TypedLength {
  readonly mm: number;
  readonly unit: TypedUnit;
}

const MM_PER_UNIT: Record<TypedUnit, number> = { mm: 1, cm: 10, m: 1000 };
/** Editor ghi mét mà gõ số trần lớn hơn thế này (`3500`) thì hiểu là mm — tường căn hộ không dài 30 m. */
const BARE_METRE_LIMIT = 30;
const MAX_BUFFER = 12;
const TYPED = /^(\d[\d.,]*)\s*(mm|cm|m)?$/iu;

/** `"3500"`, `"3,5"`, `"3.5 m"`, `"350cm"` → mm. Chưa đọc được (đang gõ dở `"3,5c"`) → `null`. */
export function parseTypedLength(text: string, notation: 'meters' | 'millimeters'): TypedLength | null {
  const match = TYPED.exec(text.trim());
  if (!match?.[1]) return null;
  const value = parseNumber(match[1]);
  if (value === undefined || value <= 0) return null;
  const suffix = match[2]?.toLowerCase() as TypedUnit | undefined;
  const unit = suffix ?? (notation === 'millimeters' || value > BARE_METRE_LIMIT ? 'mm' : 'm');
  return { mm: value * MM_PER_UNIT[unit], unit };
}

/**
 * Ô gõ sau một phím. `null` = phím này không thuộc ô gõ (để editor xử lý như thường).
 * Chỉ chữ số mới mở ô, nên `m`/`c`/`,` lúc chưa gõ gì vẫn là phím tắt của editor.
 */
export function nextTypedBuffer(buffer: string, key: string): string | null {
  if (key === 'Backspace') return buffer === '' ? null : buffer.slice(0, -1);
  if (buffer.length >= MAX_BUFFER) return /^[\d.,cm]$/iu.test(key) ? buffer : null;
  if (/^\d$/u.test(key)) return buffer + key;
  if (buffer !== '' && /^[.,cm]$/iu.test(key)) return buffer + key.toLowerCase();
  return null;
}

/** Điểm cách `start` đúng `metres` theo hướng `toward`. Chưa có hướng (con trỏ còn ở điểm đầu) → `null`. */
export function pointAtLength(start: PlanPoint, toward: PlanPoint, metres: number): PlanPoint | null {
  const dx = toward[0] - start[0];
  const dz = toward[1] - start[1];
  const distance = Math.hypot(dx, dz);
  if (distance < 1e-6) return null;
  return [start[0] + (dx / distance) * metres, start[1] + (dz / distance) * metres];
}

export interface ToolHintState {
  readonly mode: string;
  readonly tool: string | null;
  /** Tường đã có điểm đầu (đang kéo đoạn tiếp theo). */
  readonly wallDrafting: boolean;
}

const POLYGON_TOOLS = new Set(['slab', 'ceiling', 'zone']);

/** Một dòng "bước tiếp theo" cho công cụ đang cầm. Không có gì đáng nói → `null` (không vẽ dòng). */
export function toolHintOf({ mode, tool, wallDrafting }: ToolHintState): string | null {
  if (mode !== 'build' || !tool || tool === 'measurement') return null;
  if (tool === 'wall') {
    return wallDrafting
      ? 'Bấm điểm cuối, hoặc gõ chiều dài rồi Enter · Bấm đúp để kết thúc · Esc để huỷ'
      : 'Bấm để đặt điểm đầu tường · Esc để thoát công cụ';
  }
  if (POLYGON_TOOLS.has(tool)) return 'Bấm lần lượt từng góc · Bấm lại góc đầu để khép vùng · Esc để huỷ';
  if (tool === 'door' || tool === 'window') return 'Bấm lên tường để đặt · Esc để thoát công cụ';
  if (tool === 'item') return 'Bấm để đặt đồ đạc · Esc để thoát công cụ';
  return 'Esc để thoát công cụ';
}

export type SnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'wall';

const SNAP_LABELS: Record<SnapKind, string> = {
  endpoint: 'Đầu tường',
  midpoint: 'Trung điểm',
  intersection: 'Giao điểm',
  wall: 'Trên tường',
};

/** Chữ cạnh con trỏ nói điểm vừa bị hút vào đâu — hình vuông/tam giác/chữ thập của Pascal thành lời. */
export function snapLabelOf(kind: SnapKind | null, aligned: boolean): string | null {
  if (kind) return SNAP_LABELS[kind];
  return aligned ? 'Thẳng hàng' : null;
}
