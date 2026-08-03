export const APP_ERROR_KINDS = [
  'network',
  'timeout',
  'unauthenticated',
  'forbidden',
  'notFound',
  'conflict',
  'validation',
  'rateLimited',
  'upload',
  'processing',
  'geometry',
  'export',
  'unknown',
] as const;

export type AppErrorKind = (typeof APP_ERROR_KINDS)[number];

export type AppErrorSeverity = 'cảnh báo' | 'lỗi' | 'nghiêm trọng';

export type AppErrorRecovery = 'thử lại' | 'tải lại' | 'liên hệ quản trị' | 'không';

export interface AppErrorParams {
  [key: string]: string | number | boolean | null | undefined;
}

export interface AppError {
  kind: AppErrorKind;
  code: string;
  messageKey: string;
  params: AppErrorParams;
  requestId: string;
  retryable: boolean;
  severity: AppErrorSeverity;
  recovery: AppErrorRecovery;
}

export interface AppErrorKindConfig {
  code: string;
  titleKey: `errors.${AppErrorKind}.title`;
  messageKey: `errors.${AppErrorKind}.description`;
  severity: AppErrorSeverity;
  recovery: AppErrorRecovery;
  retryable: boolean;
  primaryButtonKey: 'common.retry' | 'common.reload' | 'common.contact_admin' | 'common.close';
  secondaryButtonKey: 'common.close';
}

export const APP_ERROR_KIND_CONFIG = {
  network: {
    code: 'NETWORK',
    messageKey: 'errors.network.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.network.title',
    retryable: true,
  },
  timeout: {
    code: 'TIMEOUT',
    messageKey: 'errors.timeout.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.timeout.title',
    retryable: true,
  },
  unauthenticated: {
    code: 'UNAUTHENTICATED',
    messageKey: 'errors.unauthenticated.description',
    primaryButtonKey: 'common.reload',
    recovery: 'tải lại',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.unauthenticated.title',
    retryable: false,
  },
  forbidden: {
    code: 'FORBIDDEN',
    messageKey: 'errors.forbidden.description',
    primaryButtonKey: 'common.contact_admin',
    recovery: 'liên hệ quản trị',
    secondaryButtonKey: 'common.close',
    severity: 'lỗi',
    titleKey: 'errors.forbidden.title',
    retryable: false,
  },
  notFound: {
    code: 'NOT_FOUND',
    messageKey: 'errors.notFound.description',
    primaryButtonKey: 'common.reload',
    recovery: 'tải lại',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.notFound.title',
    retryable: false,
  },
  conflict: {
    code: 'CONFLICT',
    messageKey: 'errors.conflict.description',
    primaryButtonKey: 'common.reload',
    recovery: 'tải lại',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.conflict.title',
    retryable: true,
  },
  validation: {
    code: 'VALIDATION',
    messageKey: 'errors.validation.description',
    primaryButtonKey: 'common.close',
    recovery: 'không',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.validation.title',
    retryable: false,
  },
  rateLimited: {
    code: 'RATE_LIMITED',
    messageKey: 'errors.rateLimited.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'cảnh báo',
    titleKey: 'errors.rateLimited.title',
    retryable: true,
  },
  upload: {
    code: 'UPLOAD',
    messageKey: 'errors.upload.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'lỗi',
    titleKey: 'errors.upload.title',
    retryable: true,
  },
  processing: {
    code: 'PROCESSING',
    messageKey: 'errors.processing.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'nghiêm trọng',
    titleKey: 'errors.processing.title',
    retryable: true,
  },
  geometry: {
    code: 'GEOMETRY',
    messageKey: 'errors.geometry.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'nghiêm trọng',
    titleKey: 'errors.geometry.title',
    retryable: true,
  },
  export: {
    code: 'EXPORT',
    messageKey: 'errors.export.description',
    primaryButtonKey: 'common.retry',
    recovery: 'thử lại',
    secondaryButtonKey: 'common.close',
    severity: 'lỗi',
    titleKey: 'errors.export.title',
    retryable: true,
  },
  unknown: {
    code: 'UNKNOWN',
    messageKey: 'errors.unknown.description',
    primaryButtonKey: 'common.close',
    recovery: 'không',
    secondaryButtonKey: 'common.close',
    severity: 'nghiêm trọng',
    titleKey: 'errors.unknown.title',
    retryable: false,
  },
} as const satisfies Record<AppErrorKind, AppErrorKindConfig>;
