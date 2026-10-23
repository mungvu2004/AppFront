/**
 * Chữ của trang /welcome và các hàm thuần quyết định lúc nào chữ hiện.
 *
 * Chữ nằm trong DOM (đọc được, chọn được, có tiêu đề ngữ nghĩa), không vẽ trong
 * canvas. Tiêu đề được ngắt dòng bằng tay: trình duyệt coi mỗi âm tiết tiếng Việt
 * là một "từ", nên `text-wrap: balance` hay tách "mô / hình". Trong dòng phụ, từ
 * ghép giữ liền bằng dấu cách không ngắt (NB). Nhãn phòng, kết quả kiểm tra và
 * bậc thang đọc từ dữ liệu căn nhà, không viết cứng ở đây.
 */

import { formatNumber } from '@/lib/format/number';
import type { ComplianceCheck, LandingHouse } from '@/lib/landing/types';
import type { ExportFormatId } from '@/screens/export/ExportPanel/types';

/** Tên sản phẩm trên đầu và chân trang; chủ dự án có thể đổi ở đây. */
export const WORDMARK = 'AppFront';
export const DESCRIPTOR = 'Bản vẽ thành mô hình 3D';

const NB = ' ';

export type Tone = 'ink' | 'blue' | 'amber' | 'jade' | 'coral' | 'mineral';

/** Sáu bước của sản phẩm: tên trên thanh bước, sắc của vạch, chữ cho bản tĩnh. */
export const STEPS: readonly { name: string; tone: Tone; text: string }[] = [
  { name: 'Tải lên', tone: 'ink', text: `Ảnh chụp, bản quét hoặc PDF của mặt${NB}bằng.` },
  { name: 'Nhận diện', tone: 'blue', text: `Tường, phòng, cửa và đồ đạc được nhận ra từ bản${NB}vẽ.` },
  { name: 'Chỉnh sửa', tone: 'amber', text: 'Bạn xem từng tầng và sửa chỗ AI nhận diện chưa đúng.' },
  { name: 'Dựng 3D', tone: 'mineral', text: `Một công trình thống nhất về kích thước, có thể khám${NB}phá.` },
  { name: 'Kiểm tra tự động', tone: 'jade', text: `Mô hình tự đối chiếu với các yêu cầu đã cấu${NB}hình.` },
  { name: 'Xuất', tone: 'ink', text: `Tệp .glb, .pdf, .png và${NB}.json.` },
];

/** id cảnh (timeline/scenes.ts) → bước, cùng phần phụ của dòng mắt khi một bước có nhiều cảnh. */
export const SCENE_STEP: Readonly<Record<string, { step: number; part?: string }>> = {
  s01: { step: 0 },
  s02: { step: 0, part: 'Đo đạc' },
  s03: { step: 1 },
  s04: { step: 2 },
  s05: { step: 3, part: 'Tường' },
  s06: { step: 3, part: 'Bên trong' },
  s07: { step: 3, part: 'Ba tầng' },
  s08: { step: 4 },
  s09: { step: 5 },
};

const pad = (n: number): string => String(n).padStart(2, '0');
export const stepNumber = (i: number): string => pad(i + 1);

/** "Bước 02 / 06 — Nhận diện" (CSS viết hoa). */
export function eyebrow(sceneId: string): string {
  const at = SCENE_STEP[sceneId];
  if (at === undefined) return '';
  const head = `Bước ${pad(at.step + 1)} / ${pad(STEPS.length)} — ${STEPS[at.step]?.name ?? ''}`;
  return at.part === undefined ? head : `${head} · ${at.part}`;
}

/** Một cảnh có chữ. `accent` là một từ trong tiêu đề tô bằng sắc mang nghĩa của cảnh. */
export interface SceneCopy {
  readonly id: string;
  readonly title?: readonly string[];
  readonly accent?: { readonly word: string; readonly tone: Tone };
  readonly sub?: string;
  readonly note?: string;
}

const NOTE = 'Dữ liệu minh hoạ';

export const SCENE_COPY: readonly SceneCopy[] = [
  {
    id: 's01',
    title: ['Bản vẽ biết trở thành', 'ngôi nhà.'],
    sub: `Từ mặt${NB}bằng 2D đến mô${NB}hình${NB}3D có${NB}thể${NB}kiểm${NB}tra.`,
  },
  { id: 's02', title: ['Từ bản vẽ đến hình học', 'có thể đo lường.'] },
  {
    id: 's03',
    title: ['AI nhận diện.', 'Hình học bắt đầu có ý nghĩa.'],
    accent: { word: 'nhận diện', tone: 'blue' },
    note: NOTE,
  },
  { id: 's04', title: ['Bạn kiểm tra.', 'Bạn quyết định.'], accent: { word: 'kiểm tra', tone: 'amber' } },
  { id: 's05', title: ['Từ nét vẽ.', 'Thành không gian thật.'] },
  { id: 's06', title: ['Bước vào.', 'Đo được từng không gian.'], accent: { word: 'Đo được', tone: 'mineral' } },
  { id: 's07', title: ['Ba tầng.', 'Một mô hình thống nhất.'], accent: { word: 'thống nhất', tone: 'jade' } },
  { id: 's08', title: ['Không chỉ dựng hình.', 'Còn giúp phát hiện vấn đề.'], accent: { word: 'vấn đề', tone: 'coral' } },
];

export const HERO = SCENE_COPY[0] as SceneCopy;
export const FINAL = { title: 'Bản vẽ của bạn.', sub: 'Bắt đầu một công trình mới.' } as const;
export const FOOTER_NOTE = 'Dữ liệu trên trang là minh hoạ.';
export const CTA_HINT = 'Đăng nhập để tạo dự án';
export const SKIP_LABEL = 'Tới phần bắt đầu';
export const PLAN_TAG = 'Mặt bằng tầng 1 · Dữ liệu minh hoạ';
export const FLOORS_HEAD = 'Mặt bằng từng tầng · Dữ liệu minh hoạ';
/** 'T2' → 'Tầng 2'. */
export const levelName = (id: string): string => `Tầng ${id.replace(/^T/, '')}`;
export const CHECKS_HEAD = 'Kiểm tra yêu cầu · Dữ liệu minh hoạ';

/** Đúng bốn định dạng màn Xuất có (ExportPanel/types.ts), mỗi cái kèm thứ người dùng nhận được. */
export const EXPORTS: readonly { id: ExportFormatId; format: string; label: string }[] = [
  { id: 'glb', format: '.glb', label: 'Mô hình 3D' },
  { id: 'pdf', format: '.pdf', label: 'Hồ sơ in' },
  { id: 'image', format: '.png', label: 'Ảnh mặt bằng' },
  { id: 'spatial-json', format: '.json', label: 'Dữ liệu cho phần mềm khác' },
];

/* -------------------------------------------------------------------------- */
/* Nhãn và kết quả kiểm tra, suy ra từ dữ liệu căn nhà.                        */
/* -------------------------------------------------------------------------- */

export interface LabelCopy {
  readonly id: string;
  readonly tone: Tone;
  /** 'room': ghi chú không khung có đường dẫn; 'mark': khung kiểu ghi chú bản vẽ. */
  readonly kind: 'room' | 'mark';
  readonly name: string;
  readonly meta?: string;
  /** Phần "cần ≥ …" của một mục chưa đạt, tách khỏi giá trị để không chỉ dựa vào màu. */
  readonly rule?: string;
  /** Nhãn phụ: ẩn ở màn hẹp để chỉ còn vài nhãn. */
  readonly minor?: boolean;
}

/** "Cửa WC ≥ 0,75 m" → tên "Cửa WC", điều kiện "≥ 0,75 m". */
export function splitRule(label: string): { name: string; rule?: string } {
  const m = /^(.*?)\s*([≥≤<>].*)$/.exec(label);
  return m?.[1] && m[2] ? { name: m[1], rule: m[2] } : { name: label };
}

export interface CheckRow {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly rule?: string;
  readonly suggestion?: string;
}

export const failingChecks = (checks: readonly ComplianceCheck[]): CheckRow[] =>
  checks
    .filter((c) => !c.pass)
    .map((c) => ({ id: c.id, value: c.value, ...splitRule(c.label), ...(c.suggestion === undefined ? {} : { suggestion: c.suggestion }) }));

export function checkSummary(checks: readonly ComplianceCheck[]): { total: number; pass: number; fail: number } {
  const pass = checks.filter((c) => c.pass).length;
  return { total: checks.length, pass, fail: checks.length - pass };
}

/** Mọi nhãn có thể neo vào mô hình; timeline quyết định nhãn nào hiện (state.labels). */
export function labelsFor(house: LandingHouse): LabelCopy[] {
  return [
    ...house.detections
      .filter((d) => d.labelled)
      .map((d, i): LabelCopy => ({
        id: `det:${d.furnitureId}`,
        tone: 'blue',
        kind: 'mark',
        name: d.label,
        meta: formatNumber(d.confidence, { fractionDigits: 2 }),
        minor: i >= 2,
      })),
    { id: 'gap', tone: 'amber', kind: 'mark', name: 'Đoạn tường bị hở' },
    ...house.rooms.map((r): LabelCopy => ({
      id: `room:${r.roomId}`,
      tone: 'jade',
      kind: 'room',
      name: r.name,
      meta: `${formatNumber(r.statedAreaM2, { maxFractionDigits: 1 })} m²`,
    })),
    { id: 'stair', tone: 'jade', kind: 'room', name: 'Cầu thang', meta: `${house.stair.risers} bậc` },
    ...failingChecks(house.checks).map((c): LabelCopy => ({
      id: `check:${c.id}`,
      tone: 'coral',
      kind: 'mark',
      name: `${c.name} ${c.value}`,
      ...(c.rule === undefined ? {} : { rule: `cần ${c.rule}` }),
    })),
  ];
}

/* -------------------------------------------------------------------------- */

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const easeOut = (t: number): number => 1 - (1 - t) ** 3; // vào: nhanh rồi dịu
const easeIn = (t: number): number => t * t; // ra: chậm rồi dứt

/** Phần của cảnh dành cho lúc vào; nhảy tới một bước rơi vào sau đoạn này để chữ đã hiện. */
export const ENTER = 0.2;
const LEAVE = 0.16;
const TRAVEL_IN = 20; // px
const TRAVEL_OUT = 12;

export interface CopyPhase {
  readonly opacity: number;
  readonly y: number;
}

/**
 * Độ mờ và độ trượt của một dòng chữ trong cảnh [start, end].
 * `delay` (0..1, theo độ dài cảnh) lùi lúc vào để dòng phụ đến sau dòng chính.
 * `holdAtEnd` giữ nguyên ở cảnh cuối thay vì rời đi; `holdAtStart` bỏ lúc vào
 * (cảnh đầu: trang mở ra ở p = 0 phải đã có chữ).
 */
export function copyPhase(p: number, start: number, end: number, delay = 0, holdAtEnd = false, holdAtStart = false): CopyPhase {
  const len = end - start;
  if (p < start || p > end || len <= 0) {
    return { opacity: 0, y: 0 };
  }
  const local = (p - start) / len;
  const into = holdAtStart ? 1 : easeOut(clamp01((local - delay) / ENTER));
  const out = holdAtEnd ? 0 : easeIn(clamp01((local - (1 - LEAVE)) / LEAVE));

  return {
    opacity: Math.max(0, into * (1 - out)),
    y: (1 - into) * TRAVEL_IN - out * TRAVEL_OUT,
  };
}
