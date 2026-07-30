import React from 'react';

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
            <button
              onClick={primaryButton.onClick}
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                state === 'violation'
                  ? 'bg-state-violation text-white hover:bg-state-violation/90 focus:ring-state-violation'
                  : state === 'attention'
                  ? 'bg-state-attention text-white hover:bg-state-attention/90 focus:ring-state-attention'
                  : 'bg-state-verified text-white hover:bg-state-verified/90 focus:ring-state-verified'
              }`}
            >
              {primaryButton.text}
            </button>
          )}
          {secondaryButton && (
            <button
              onClick={secondaryButton.onClick}
              className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles.text} hover:bg-black/5 focus:ring-black/10`}
            >
              {secondaryButton.text}
            </button>
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
