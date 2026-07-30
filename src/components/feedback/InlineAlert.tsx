import React from 'react';
import { Button } from '../ui/Button';

export type AlertState = 'verified' | 'attention' | 'violation';

export interface InlineAlertProps {
  state: AlertState;
  title: string;
  cause: string;
  errorCode: string;
  primaryButton?: {
    text: string;
    onClick: () => void;
  };
  secondaryButton?: {
    text: string;
    onClick: () => void;
  };
}

export function InlineAlert({
  state,
  title,
  cause,
  errorCode,
  primaryButton,
  secondaryButton,
}: InlineAlertProps) {
  const styles = {
    verified: {
      bg: 'bg-state-verified-tint',
      border: 'border-state-verified/30',
      text: 'text-state-verified-text',
    },
    attention: {
      bg: 'bg-state-attention-tint',
      border: 'border-state-attention/30',
      text: 'text-state-attention-text',
    },
    violation: {
      bg: 'bg-state-violation-tint',
      border: 'border-state-violation/30',
      text: 'text-state-violation-text',
    },
  }[state];

  return (
    <div className={`p-4 rounded-xl border ${styles.bg} ${styles.border} flex flex-col gap-3 relative`}>
      <div>
        <h4 className={`font-medium ${styles.text} mb-1`}>{title}</h4>
        <p className={`text-[15px] ${styles.text} opacity-90`}>{cause}</p>
      </div>

      {(primaryButton || secondaryButton) && (
        <div className="flex gap-3 mt-1">
          {primaryButton && (
            <Button
              variant="danger"
              size="sm"
              onClick={primaryButton.onClick}
            >
              {primaryButton.text}
            </Button>
          )}
          {secondaryButton && (
            <Button
              variant="ghost"
              size="sm"
              onClick={secondaryButton.onClick}
            >
              {secondaryButton.text}
            </Button>
          )}
        </div>
      )}

      <div className="absolute bottom-4 right-4">
        <span className={`font-mono text-xs ${styles.text} opacity-70 uppercase`}>
          {errorCode}
        </span>
      </div>
    </div>
  );
}
