export { APP_ERROR_KINDS, APP_ERROR_KIND_CONFIG } from './kinds';
export type {
  AppError,
  AppErrorKind,
  AppErrorKindConfig,
  AppErrorParams,
  AppErrorRecovery,
  AppErrorSeverity,
} from './kinds';
export { describeError } from './describeError';
export type { ErrorDescription } from './describeError';
export { ERROR_REPORTED_EVENT, reportError } from './report';
export type { ErrorTelemetryContext, ErrorTelemetryDetail } from './report';
export { toAppError } from './toAppError';
