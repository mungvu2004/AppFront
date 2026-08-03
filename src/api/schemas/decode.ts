import { z, type ZodIssue } from 'zod';

import { APP_ERROR_KIND_CONFIG, type AppError } from '@/lib/errors';
import type { Result } from '@/lib/http';

const MAX_ISSUES = 5;
const MAX_INVALID_RATIO = 0.2;

export interface DecodeWarning {
  index: number;
  message: string;
  source: string;
}

export interface SafeParseListOptions {
  maxInvalidRatio?: number;
  warn?: (warning: DecodeWarning) => void;
}

const typeLabels: Record<string, string> = {
  array: 'danh sách',
  bigint: 'số nguyên lớn',
  boolean: 'đúng/sai',
  date: 'ngày',
  float: 'số thực',
  function: 'hàm',
  integer: 'số nguyên',
  map: 'bảng ánh xạ',
  nan: 'NaN',
  never: 'không có giá trị',
  null: 'null',
  number: 'số',
  object: 'đối tượng',
  promise: 'promise',
  set: 'tập',
  string: 'chuỗi',
  symbol: 'symbol',
  undefined: 'thiếu',
  unknown: 'không rõ',
  void: 'rỗng',
};

const labelType = (typeName: string): string => typeLabels[typeName] ?? typeName;

const formatPath = (source: string, path: ReadonlyArray<string | number>): string => {
  let formatted = source;

  for (const segment of path) {
    if (typeof segment === 'number') {
      formatted = `${formatted}[${segment}]`;
      continue;
    }

    formatted = formatted.length > 0 ? `${formatted}.${segment}` : segment;
  }

  return formatted;
};

const getIssuePath = (
  source: string,
  issue: ZodIssue,
  prefix: ReadonlyArray<string | number>,
): string => formatPath(source, [...prefix, ...issue.path]);

const formatInvalidTypeIssue = (
  source: string,
  issue: Extract<ZodIssue, { code: 'invalid_type' }>,
  prefix: ReadonlyArray<string | number>,
): string => {
  const field = getIssuePath(source, issue, prefix);

  if (issue.received === 'undefined') {
    return `Trường '${field}' là bắt buộc.`;
  }

  return `Trường '${field}' cần ${labelType(issue.expected)}, nhận được ${labelType(issue.received)}.`;
};

const formatIssue = (
  source: string,
  issue: ZodIssue,
  prefix: ReadonlyArray<string | number> = [],
): string => {
  const field = getIssuePath(source, issue, prefix);

  if (issue.code === 'invalid_type') {
    return formatInvalidTypeIssue(source, issue, prefix);
  }

  if (issue.code === 'invalid_string' && issue.validation === 'email') {
    return `Trường '${field}' cần email hợp lệ.`;
  }

  if (issue.code === 'invalid_string' && issue.validation === 'url') {
    return `Trường '${field}' cần URL hợp lệ.`;
  }

  if (issue.code === 'invalid_string' && issue.validation === 'datetime') {
    return `Trường '${field}' cần thời điểm ISO hợp lệ.`;
  }

  if (issue.code === 'invalid_enum_value') {
    return `Trường '${field}' nhận giá trị ngoài hợp đồng.`;
  }

  if (issue.code === 'too_small') {
    return `Trường '${field}' nhỏ hơn giới hạn cho phép.`;
  }

  if (issue.code === 'too_big') {
    return `Trường '${field}' lớn hơn giới hạn cho phép.`;
  }

  if (issue.code === 'unrecognized_keys') {
    return `Trường '${field}' có khóa ngoài hợp đồng: ${issue.keys.join(', ')}.`;
  }

  return `Trường '${field}' không đúng hợp đồng.`;
};

const formatIssues = (
  issues: readonly ZodIssue[],
  source: string,
  prefix: ReadonlyArray<string | number> = [],
): string =>
  issues
    .slice(0, MAX_ISSUES)
    .map((issue) => formatIssue(source, issue, prefix))
    .join(' ');

const createContractError = (source: string, message: string, count: number): AppError => {
  const config = APP_ERROR_KIND_CONFIG.validation;

  return {
    code: 'CONTRACT_VALIDATION',
    kind: 'validation',
    messageKey: config.messageKey,
    params: {
      count,
      message,
      source,
    },
    recovery: config.recovery,
    requestId: '',
    retryable: false,
    severity: config.severity,
  };
};

const defaultWarn = (warning: DecodeWarning): void => {
  console.warn(warning.message);
};

export function decode<S extends z.ZodTypeAny>(schema: S, data: unknown, source: string): Result<z.output<S>, AppError> {
  const parsed = schema.safeParse(data);

  if (parsed.success) {
    return { data: parsed.data, ok: true };
  }

  const message = formatIssues(parsed.error.issues, source);

  return {
    error: createContractError(source, message, parsed.error.issues.length),
    ok: false,
  };
}

export function safeParseList<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  source: string,
  options: SafeParseListOptions = {},
): Result<z.output<S>[], AppError> {
  const list = z.array(z.unknown()).safeParse(data);

  if (!list.success) {
    const message = formatIssues(list.error.issues, source);

    return {
      error: createContractError(source, message, list.error.issues.length),
      ok: false,
    };
  }

  const warn = options.warn ?? defaultWarn;
  const validItems: z.output<S>[] = [];
  const invalidMessages: string[] = [];
  const invalidIssueMessages: string[] = [];

  list.data.forEach((item, index) => {
    const parsed = schema.safeParse(item);

    if (parsed.success) {
      validItems.push(parsed.data);
      return;
    }

    const message = formatIssues(parsed.error.issues, source, [index]);
    invalidMessages.push(message);
    invalidIssueMessages.push(...parsed.error.issues.map((issue) => formatIssue(source, issue, [index])));
    warn({ index, message, source });
  });

  const maxInvalidRatio = options.maxInvalidRatio ?? MAX_INVALID_RATIO;
  const invalidCount = invalidMessages.length;
  const invalidRatio = list.data.length === 0 ? 0 : invalidCount / list.data.length;

  if (invalidRatio > maxInvalidRatio) {
    const message = [
      `${invalidCount}/${list.data.length} phần tử từ '${source}' hỏng, vượt quá ${Math.round(
        maxInvalidRatio * 100,
      )}%.`,
      invalidIssueMessages.slice(0, MAX_ISSUES).join(' '),
    ]
      .filter((part) => part.length > 0)
      .join(' ');

    return {
      error: createContractError(source, message, invalidCount),
      ok: false,
    };
  }

  return { data: validItems, ok: true };
}

