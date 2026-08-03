import viMessages from '@/i18n/vi.json';

import { APP_ERROR_KIND_CONFIG, type AppError, type AppErrorKind } from './kinds';

export interface ErrorDescription {
  title: string;
  description: string;
  primaryButtonLabel: string;
  secondaryButtonLabel: string;
}

const readPath = (value: unknown, path: string): string | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  return path.split('.').reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[key];
  }, value) as string | undefined;
};

const formatTemplate = (template: string, params: AppError['params']): string =>
  template.replace(/\{\{(\w+)\}\}|\{(\w+)\}/g, (_match, doubleName: string, singleName: string) => {
    const key = doubleName || singleName;
    const value = params[key];

    if (value === undefined || value === null) {
      return '';
    }

    return String(value);
  });

const readMessage = (path: string): string => readPath(viMessages, path) ?? '';

const resolvePrimaryLabel = (kind: AppErrorKind, error: AppError): string => {
  if (error.recovery === 'không') {
    return readMessage('common.close');
  }

  return readMessage(APP_ERROR_KIND_CONFIG[kind].primaryButtonKey);
};

export function describeError(error: AppError): ErrorDescription {
  const config = APP_ERROR_KIND_CONFIG[error.kind];

  return {
    description: formatTemplate(readMessage(config.messageKey), error.params),
    primaryButtonLabel: resolvePrimaryLabel(error.kind, error),
    secondaryButtonLabel: readMessage(config.secondaryButtonKey),
    title: formatTemplate(readMessage(config.titleKey), error.params),
  };
}
