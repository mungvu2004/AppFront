/**
 * `/login/reset-password` in each of invariant A11's seven states.
 *
 * Every story renders {@link PasswordResetView}, so nothing here needs a port, a router
 * or a token in the address bar. Wording is read from `src/i18n/vi.json`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import viMessages from '@/i18n/vi.json';

import { PasswordResetView, type PasswordResetViewProps } from './PasswordReset';

const AUTH = viMessages.auth;

const meta = {
  title: 'Screens/Auth/PasswordReset',
  component: PasswordResetView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof PasswordResetView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;
const SAMPLE_PASSWORD = 'mat-khau-moi-1';

const base: PasswordResetViewProps = {
  state: 'empty',
  values: { newPassword: '', confirmPassword: '' },
  problems: {},
  notice: null,
  canSubmit: true,
  isSubmitting: false,
  isDone: false,
  setNewPassword: noop,
  setConfirmPassword: noop,
  submit: noop,
  goToSignIn: noop,
  expand: noop,
};

/** Nothing typed yet. */
export const Empty: Story = { args: base };

/** The request is in flight. */
export const Sending: Story = {
  args: {
    ...base,
    state: 'loading',
    isSubmitting: true,
    canSubmit: false,
    values: { newPassword: SAMPLE_PASSWORD, confirmPassword: SAMPLE_PASSWORD },
  },
};

/** Only the new password has been typed. */
export const Partial: Story = {
  args: { ...base, state: 'partial', values: { newPassword: SAMPLE_PASSWORD, confirmPassword: '' } },
};

/** A retryable failure: too many attempts. The button is shut and no number is promised. */
export const Retryable: Story = {
  args: {
    ...base,
    state: 'error',
    canSubmit: false,
    values: { newPassword: SAMPLE_PASSWORD, confirmPassword: SAMPLE_PASSWORD },
    notice: {
      tone: 'attention',
      title: AUTH.errors.tooManyAttempts.title,
      message: AUTH.errors.tooManyRecovery,
    },
  },
};

/** 204: the password changed and the screen is about to go to /login. */
export const Success: Story = {
  args: { ...base, state: 'success', isDone: true, canSubmit: false },
};

/** The link is dead (missing, malformed, expired or used): the form is gone. */
export const Forbidden: Story = { args: { ...base, state: 'forbidden' } };

/** Folded away, for a host that embeds the screen. */
export const Collapsed: Story = { args: { ...base, state: 'collapsed' } };
