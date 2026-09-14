/**
 * S-36 — phần tính toán thuần của màn xem Spatial JSON.
 *
 * Không React, không kho, không mạng. Vào là một `SpatialGraph` cộng trạng thái
 * gấp mở, ra là những hàng view chỉ việc `map`. Đặt ở đây chứ không trong hook
 * vì mục B: "tính toán không nằm trong màn hình" — và một hàm thuần thì test
 * được không cần dựng cây React.
 *
 * ## Vì sao dàn phẳng thay vì để view đệ quy
 *
 * Cây JSON của bộ mẫu chuẩn sâu bốn bậc và rộng vài nghìn nút. View đệ quy phải
 * giữ trạng thái gấp mở ở từng nhánh, và lúc đó nó không còn test được từ props
 * (R-60). Dàn phẳng một lần rồi lọc theo tập nút đang mở thì view là một danh
 * sách, trạng thái nằm trong hook, và cả hai đều kiểm được riêng.
 *
 * ## Ba tông, và boolean/null đi cùng số
 *
 * Đặc tả đòi **đúng ba** tông. JSON có bốn loại giá trị vô hướng: chuỗi, số,
 * boolean, null. Ba tông nghĩa là có hai loại phải dùng chung một tông, và
 * nhóm đúng là "không phải chuỗi" — `220`, `true` và `null` đều là giá trị máy
 * đọc, còn chuỗi là thứ người đọc. Nên `tone: 'number'` phủ cả ba.
 */

import { formatNumber } from '@/lib/format/number';

import type {
  SpatialJsonCounts,
  SpatialJsonIssue,
  SpatialJsonNode,
  SpatialJsonTone,
  SpatialJsonValidity,
} from './types';

/** Chuỗi dài hơn ngần này bị cắt trong cây; chế độ thô vẫn hiện đủ. */
const MAX_VALUE_PREVIEW = 64;

/** Số thụt lề của `JSON.stringify`, khớp mono 13/20 của khối chữ đều. */
const RAW_INDENT = 2;

/** Ký hiệu cắt chuỗi. */
const ELLIPSIS = '…';

/**
 * Một hàng của cây trước khi lọc theo trạng thái gấp mở.
 *
 * Không mang `parentId`: tổ tiên suy ra được từ chính đường dẫn
 * ({@link ancestorsOf}), nên giữ thêm một trường nữa là giữ cùng một sự thật ở
 * hai chỗ.
 */
type FlatNode = Omit<SpatialJsonNode, 'isExpanded' | 'isMatch'>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Giá trị vô hướng thành chữ, đã cắt ngắn. Số đi qua `formatNumber` (A15). */
const describeScalar = (value: unknown): { text: string; tone: SpatialJsonTone } => {
  if (typeof value === 'string') {
    const text = value.length > MAX_VALUE_PREVIEW ? `${value.slice(0, MAX_VALUE_PREVIEW)}${ELLIPSIS}` : value;

    return { text: `"${text}"`, tone: 'string' };
  }

  if (typeof value === 'number') {
    return { text: formatNumber(value, { fractionDigits: Number.isInteger(value) ? 0 : 2 }), tone: 'number' };
  }

  if (typeof value === 'boolean') {
    return { text: value ? 'true' : 'false', tone: 'number' };
  }

  return { text: 'null', tone: 'number' };
};

/** Mã thực thể của một phần tử mảng, nếu nó là đối tượng có `id` dạng chuỗi. */
const readEntityId = (value: unknown): string | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  return typeof value.id === 'string' ? value.id : null;
};

const childPath = (parentPath: string, key: string): string =>
  parentPath.length === 0 ? key : `${parentPath}.${key}`;

/** Đi hết một giá trị JSON, đẩy từng hàng vào `out`. */
function walk(
  value: unknown,
  path: string,
  label: string,
  depth: number,
  out: FlatNode[],
): void {
  if (Array.isArray(value)) {
    out.push({
      childCount: value.length,
      depth,
      entityId: null,
      id: path,
      isExpandable: value.length > 0,
      label,
      tone: 'none',
      valueText: null,
    });

    value.forEach((item, index) => {
      walk(item, `${path}[${index}]`, `${index}`, depth + 1, out);
    });

    return;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);

    out.push({
      childCount: keys.length,
      depth,
      entityId: readEntityId(value),
      id: path,
      isExpandable: keys.length > 0,
      label,
      tone: 'none',
      valueText: null,
    });

    for (const key of keys) {
      walk(value[key], childPath(path, key), key, depth + 1, out);
    }

    return;
  }

  const scalar = describeScalar(value);

  out.push({
    childCount: null,
    depth,
    entityId: null,
    id: path,
    isExpandable: false,
    label,
    tone: scalar.tone,
    valueText: scalar.text,
  });
}

/** Mọi hàng của cây, kể cả hàng đang bị gấp lại. */
export function flattenJson(value: unknown): readonly SpatialJsonNode[] {
  const out: FlatNode[] = [];

  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      walk(value[key], key, key, 0, out);
    }
  }

  return out.map((node) => ({ ...node, isExpanded: false, isMatch: false }));
}

/** Mọi tổ tiên của một hàng, từ gần nhất ra gốc. */
export function ancestorsOf(nodeId: string): readonly string[] {
  const ancestors: string[] = [];
  let cursor = nodeId;

  while (cursor.length > 0) {
    const lastDot = cursor.lastIndexOf('.');
    const lastBracket = cursor.lastIndexOf('[');
    const cut = Math.max(lastDot, lastBracket);

    if (cut <= 0) {
      break;
    }

    cursor = cursor.slice(0, cut);
    ancestors.push(cursor);
  }

  return ancestors;
}

const matchesQuery = (node: SpatialJsonNode, needle: string): boolean =>
  node.label.toLowerCase().includes(needle) || (node.valueText ?? '').toLowerCase().includes(needle);

/** Mã của mọi hàng khớp ô tìm kiếm, theo thứ tự trên xuống. */
export function findMatches(nodes: readonly SpatialJsonNode[], query: string): readonly string[] {
  const needle = query.trim().toLowerCase();

  if (needle.length === 0) {
    return [];
  }

  return nodes.filter((node) => matchesQuery(node, needle)).map((node) => node.id);
}

/**
 * Hàng đang nhìn thấy: hàng gốc luôn hiện, hàng con chỉ hiện khi MỌI tổ tiên mở.
 *
 * Đánh dấu `isMatch` tại đây thay vì ở view, để view không phải biết ô tìm kiếm
 * đang gõ gì.
 */
export function visibleNodes(
  nodes: readonly SpatialJsonNode[],
  expandedIds: ReadonlySet<string>,
  matchIds: ReadonlySet<string>,
): readonly SpatialJsonNode[] {
  return nodes
    .filter((node) => ancestorsOf(node.id).every((ancestor) => expandedIds.has(ancestor)))
    .map((node) => ({
      ...node,
      isExpanded: expandedIds.has(node.id),
      isMatch: matchIds.has(node.id),
    }));
}

/** Đếm phần tử của từng nhóm gốc. Nhận `unknown` để khỏi ép kiểu ở nơi gọi. */
export function countEntities(graph: unknown): SpatialJsonCounts {
  const record = isPlainObject(graph) ? graph : {};

  const lengthOf = (key: string): number => {
    const value = record[key];

    return Array.isArray(value) ? value.length : 0;
  };

  return {
    axes: lengthOf('axes'),
    dimensions: lengthOf('dimensions'),
    furniture: lengthOf('furniture'),
    levels: lengthOf('levels'),
    openings: lengthOf('openings'),
    rooms: lengthOf('rooms'),
    walls: lengthOf('walls'),
  };
}

/** "4 tầng · 48 tường · 16 ô mở · 14 phòng" — định dạng ở đây, không ở view (A15). */
export function describeCounts(counts: SpatialJsonCounts): string {
  const parts: readonly string[] = [
    `${formatNumber(counts.levels)} tầng`,
    `${formatNumber(counts.walls)} tường`,
    `${formatNumber(counts.openings)} ô mở`,
    `${formatNumber(counts.rooms)} phòng`,
    `${formatNumber(counts.furniture)} đồ đạc`,
    `${formatNumber(counts.axes)} trục`,
    `${formatNumber(counts.dimensions)} kích thước`,
  ];

  return parts.join(' · ');
}

/** Chữ thô đã thụt lề. Đây cũng là thứ nút sao chép chép đi. */
export function toRawText(value: unknown): string {
  return JSON.stringify(value, null, RAW_INDENT) ?? '';
}

/** Số byte UTF-8 của chữ thô — cỡ tệp thật, không phải số ký tự. */
export function byteLengthOf(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Dải kiểm tra hợp lệ: một chấm, một câu, rồi từng lỗi một hàng. */
export function summariseValidity(issues: readonly SpatialJsonIssue[]): SpatialJsonValidity {
  const criticalCount = issues.filter((issue) => issue.severity === 'critical').length;
  const warningCount = issues.length - criticalCount;
  const isValid = issues.length === 0;

  const summary = isValid
    ? 'Hợp lệ theo hợp đồng Spatial JSON — 0 lỗi.'
    : `${formatNumber(criticalCount)} lỗi nghiêm trọng · ${formatNumber(warningCount)} cảnh báo.`;

  return { criticalCount, isValid, issues, summary, warningCount };
}

/** Một mẩu của dòng chữ thô, đã gán tông. */
export interface RawSegment {
  readonly text: string;
  readonly tone: SpatialJsonTone;
}

/**
 * Bắt ba loại token của JSON, theo đúng thứ tự ưu tiên:
 *
 * 1. `"khoá":` — chuỗi đứng ngay trước dấu hai chấm là KHOÁ, không phải giá trị;
 * 2. `"chuỗi"` — mọi chuỗi còn lại;
 * 3. số, `true`, `false`, `null` — nhóm "không phải chuỗi", xem đầu file.
 *
 * Nhánh thứ nhất phải đứng trước nhánh thứ hai, nếu không mọi khoá đều bị tô
 * thành chuỗi và ba tông rút xuống còn hai.
 */
const JSON_TOKEN_PATTERN =
  /("(?:[^"\\]|\\.)*"\s*:)|("(?:[^"\\]|\\.)*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/g;

/**
 * Cắt một dòng chữ thô thành những mẩu đã gán tông.
 *
 * Hàm thuần, không chạm DOM: view chỉ việc `map` kết quả ra `<span>`. Đây là
 * cách chế độ thô giữ đúng ba tông của cây mà không cần một thư viện tô cú pháp
 * nào — thêm một thư viện cho việc này là đổi vài KiB ngân sách gói lấy một
 * biểu thức chính quy ba nhánh.
 */
export function tokenizeJsonLine(line: string): readonly RawSegment[] {
  const segments: RawSegment[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(JSON_TOKEN_PATTERN)) {
    const index = match.index ?? 0;

    if (index > lastIndex) {
      segments.push({ text: line.slice(lastIndex, index), tone: 'none' });
    }

    const [whole, keyToken, stringToken] = match;

    if (keyToken !== undefined) {
      segments.push({ text: whole, tone: 'key' });
    } else if (stringToken !== undefined) {
      segments.push({ text: whole, tone: 'string' });
    } else {
      segments.push({ text: whole, tone: 'number' });
    }

    lastIndex = index + whole.length;
  }

  if (lastIndex < line.length) {
    segments.push({ text: line.slice(lastIndex), tone: 'none' });
  }

  return segments;
}
