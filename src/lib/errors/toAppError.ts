import { ZodError } from 'zod';

import type { HttpError } from '@/lib/http';
import { APP_ERROR_KIND_CONFIG, type AppError, type AppErrorKind, type AppErrorParams } from './kinds';

const KNOWN_HTTP_STATUS_KIND: Partial<Record<number, AppErrorKind>> = {
  401: 'unauthenticated',
  403: 'forbidden',
  404: 'notFound',
  409: 'conflict',
  413: 'upload',
  422: 'validation',
  429: 'rateLimited',
};

const KEYWORD_KIND_PATTERNS: Array<[AppErrorKind, RegExp]> = [
  ['unauthenticated', /\b(401|unauth|auth(?:entication)?|login|sign[- ]?in)\b/i],
  ['forbidden', /\b(403|forbidden|permission|not allowed|denied)\b/i],
  ['notFound', /\b(404|not found|missing)\b/i],
  ['conflict', /\b(409|conflict|version mismatch|stale|updated by someone else)\b/i],
  ['validation', /\b(422|validation|schema|zod|parse|malformed|invalid)\b/i],
  ['rateLimited', /\b(429|rate limit|too many requests|throttle)\b/i],
  ['upload', /\b(upload|413|payload too large|file too large)\b/i],
  ['export', /\b(export)\b/i],
  ['geometry', /\b(geometry|webgl|shader|program link|context lost|gpu|three)\b/i],
  ['processing', /\b(worker|thread|pipeline|process|ai|step)\b/i],
  ['timeout', /\b(timeout|timed out)\b/i],
  ['network', /\b(network|offline|fetch failed|failed to fetch|connection|disconnected)\b/i],
];

const PRIMITIVE_KEYS = ['step', 'floor', 'count', 'field', 'resource', 'fileName', 'layer'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

const readErrorText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    const cause = (value as Error & { cause?: unknown }).cause;

    return [value.name, value.message, cause instanceof Error ? cause.message : '']
      .filter(Boolean)
      .join(' ');
  }

  if (!isRecord(value)) {
    return '';
  }

  const parts = [
    readString(value.name),
    readString(value.message),
    readString(value.code),
    readString(value.errorCode),
    readString(value.statusText),
  ].filter(Boolean);

  return parts.join(' ');
};

const readRequestId = (value: unknown): string => {
  if (!isRecord(value)) {
    return '';
  }

  return (
    readString(value.requestId) ??
    readString(value.request_id) ??
    (isRecord(value.raw) ? readRequestId(value.raw) : undefined) ??
    (isRecord(value.error) ? readRequestId(value.error) : undefined) ??
    ''
  );
};

const readParams = (value: unknown): AppErrorParams => {
  const params: AppErrorParams = {};

  if (!isRecord(value)) {
    return params;
  }

  for (const key of PRIMITIVE_KEYS) {
    const current = value[key];

    if (typeof current === 'string') {
      params[key] = current;
      continue;
    }

    if (typeof current === 'number' && Number.isFinite(current)) {
      params[key] = current;
      continue;
    }

    if (typeof current === 'boolean') {
      params[key] = current;
    }
  }

  if (typeof value.count === 'string' && value.count.trim().length > 0) {
    const parsed = Number(value.count);
    if (Number.isFinite(parsed)) {
      params.count = parsed;
    }
  }

  return params;
};

const isHttpError = (value: unknown): value is HttpError =>
  isRecord(value) &&
  typeof value.kind === 'string' &&
  typeof value.requestId === 'string' &&
  typeof value.retryable === 'boolean' &&
  'raw' in value;

const isZodError = (value: unknown): value is ZodError =>
  value instanceof ZodError || (isRecord(value) && Array.isArray(value.issues) && value.name === 'ZodError');

const isWebGlError = (value: unknown): boolean => {
  const text = readErrorText(value).toLowerCase();

  return /\b(webgl|shader|program link|context lost|gpu|three)\b/i.test(text);
};

const isWorkerError = (value: unknown): boolean => {
  if (isRecord(value) && (typeof value.filename === 'string' || typeof value.lineno === 'number')) {
    return true;
  }

  const text = readErrorText(value).toLowerCase();
  return /\b(worker|thread)\b/i.test(text);
};

const resolveKindFromText = (text: string): AppErrorKind | undefined => {
  for (const [kind, pattern] of KEYWORD_KIND_PATTERNS) {
    if (pattern.test(text)) {
      return kind;
    }
  }

  return undefined;
};

const resolveHttpKind = (error: HttpError): AppErrorKind => {
  if (error.kind === 'network') {
    return 'network';
  }

  if (error.kind === 'timeout') {
    return 'timeout';
  }

  if (error.kind === 'auth') {
    return 'unauthenticated';
  }

  if (error.kind === 'parse') {
    return 'unknown';
  }

  const statusKind = error.status ? KNOWN_HTTP_STATUS_KIND[error.status] : undefined;
  if (statusKind) {
    return statusKind;
  }

  const codeText = [error.code, readErrorText(error.raw), String(error.status ?? '')]
    .filter(Boolean)
    .join(' ');

  const keywordKind = resolveKindFromText(codeText);
  if (keywordKind) {
    return keywordKind;
  }

  return 'unknown';
};

const resolveKindFromUnknown = (value: unknown): AppErrorKind => {
  const text = readErrorText(value);
  const keywordKind = resolveKindFromText(text);
  if (keywordKind) {
    return keywordKind;
  }

  if (isWebGlError(value)) {
    return 'geometry';
  }

  if (isWorkerError(value)) {
    return 'processing';
  }

  if (isZodError(value)) {
    return 'validation';
  }

  return 'unknown';
};

const resolveCode = (kind: AppErrorKind, sourceCode: string | undefined): string =>
  sourceCode && sourceCode.trim().length > 0 ? sourceCode : APP_ERROR_KIND_CONFIG[kind].code;

const resolveRetryable = (kind: AppErrorKind, sourceRetryable?: boolean): boolean =>
  Boolean(sourceRetryable ?? false) || APP_ERROR_KIND_CONFIG[kind].retryable;

const buildAppError = (
  kind: AppErrorKind,
  input: unknown,
  options?: {
    code?: string;
    requestId?: string;
    retryable?: boolean;
    params?: AppErrorParams;
  },
): AppError => {
  const config = APP_ERROR_KIND_CONFIG[kind];
  const params = options?.params ?? readParams(input);

  if (kind === 'processing' && params.step === undefined) {
    params.step = 'này';
  }

  if (kind === 'geometry') {
    if (params.count === undefined) {
      params.count = 0;
    }

    if (params.floor === undefined) {
      params.floor = 'này';
    }
  }

  return {
    code: resolveCode(kind, options?.code),
    kind,
    messageKey: config.messageKey,
    params,
    recovery: config.recovery,
    requestId: options?.requestId ?? readRequestId(input),
    retryable: resolveRetryable(kind, options?.retryable),
    severity: config.severity,
  };
};

const fromHttpError = (error: HttpError): AppError => {
  const kind = resolveHttpKind(error);

  return buildAppError(kind, error, {
    ...(error.code ? { code: error.code } : {}),
    params: readParams(error.raw),
    requestId: error.requestId,
    retryable: error.retryable,
  });
};

const fromZodError = (error: ZodError): AppError =>
  buildAppError('validation', error, {
    code: 'VALIDATION',
    params: {
      count: error.issues.length,
    },
    requestId: readRequestId(error),
    retryable: false,
  });

const fromWebGlError = (error: unknown): AppError =>
  buildAppError('geometry', error, {
    requestId: readRequestId(error),
    retryable: true,
  });

const fromWorkerError = (error: unknown): AppError => {
  const text = readErrorText(error);
  const kind = resolveKindFromText(text) ?? 'processing';

  return buildAppError(kind, error, {
    requestId: readRequestId(error),
    retryable: true,
  });
};

export function toAppError(error: unknown): AppError {
  const candidate =
    isRecord(error) && error.error instanceof Error
      ? error.error
      : isRecord(error) && error.cause instanceof Error
        ? error.cause
        : error;

  if (isHttpError(candidate)) {
    return fromHttpError(candidate);
  }

  if (isZodError(candidate)) {
    return fromZodError(candidate);
  }

  if (isWebGlError(candidate)) {
    return fromWebGlError(candidate);
  }

  if (isWorkerError(candidate)) {
    return fromWorkerError(candidate);
  }

  const kind = resolveKindFromUnknown(candidate);

  return buildAppError(kind, candidate, {
    requestId: readRequestId(candidate),
    retryable: kind === 'unknown' ? false : APP_ERROR_KIND_CONFIG[kind].retryable,
  });
}

