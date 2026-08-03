import { toAppError } from './toAppError';
import type { AppError } from './kinds';

export const ERROR_REPORTED_EVENT = 'telemetry:error';

export interface ErrorTelemetryContext {
  [key: string]: unknown;
}

export interface ErrorTelemetryDetail {
  appError: AppError;
  context: Record<string, string | number | boolean>;
  timestamp: string;
}

let fallbackEventTarget: EventTarget | null = null;

const SENSITIVE_CONTEXT_KEY_RE = /(?:email|name|token|secret|password|pass|session|phone|address|user|stack|raw|payload|body|message|error|detail|trace|cookie|auth)/i;

const getEventTarget = (): EventTarget => {
  if (typeof window !== 'undefined') {
    return window;
  }

  fallbackEventTarget ??= new EventTarget();
  return fallbackEventTarget;
};

const createTelemetryEvent = <TDetail>(eventName: string, detail: TDetail): Event => {
  if (typeof CustomEvent !== 'undefined') {
    return new CustomEvent<TDetail>(eventName, { detail });
  }

  const event = new Event(eventName) as Event & { detail?: TDetail };
  event.detail = detail;
  return event;
};

/**
 * Làm sạch ngữ cảnh telemetry bằng cách loại bỏ các trường nhạy cảm và
 * chỉ chấp nhận các kiểu dữ liệu cơ bản (chuỗi, số, boolean) ở tầng 1 (top-level).
 * Thiết kế theo chủ đích (Designed-by-intent): Mọi object hoặc mảng xếp lồng (nested payload)
 * đều tự động bị loại bỏ để tạo thành hàng rào bảo vệ chống lộ PII hay dữ liệu rò rỉ ngầm.
 */
const sanitizeContext = (context: ErrorTelemetryContext): Record<string, string | number | boolean> => {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_CONTEXT_KEY_RE.test(key)) {
      continue;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export function reportError(error: unknown, context: ErrorTelemetryContext = {}): void {
  const appError = toAppError(error);
  const detail: ErrorTelemetryDetail = {
    appError,
    context: sanitizeContext(context),
    timestamp: new Date().toISOString(),
  };

  getEventTarget().dispatchEvent(createTelemetryEvent(ERROR_REPORTED_EVENT, detail));
}
