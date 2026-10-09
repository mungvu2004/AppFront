/**
 * `/login/invitation` in each of invariant A11's seven states.
 *
 * Every story renders {@link InvitationAcceptView}, so nothing here needs a port, a
 * router or a token in the address bar. Wording is read from `src/i18n/vi.json`.
 */

import type { Meta, StoryObj } from '@storybook/react';

import viMessages from '@/i18n/vi.json';

import { InvitationAcceptView, type InvitationAcceptViewProps } from './InvitationAccept';

const AUTH = viMessages.auth;

const meta = {
  title: 'Screens/Auth/InvitationAccept',
  component: InvitationAcceptView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof InvitationAcceptView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;
const SAMPLE_NAME = 'Nguyễn Thu Hà';
const SAMPLE_PASSWORD = 'mat-khau-moi-1';

const base: InvitationAcceptViewProps = {
  state: 'empty',
  values: { fullName: '', password: '', confirmPassword: '' },
  problems: {},
  notice: null,
  warning: null,
  canSubmit: true,
  isSubmitting: false,
  isDone: false,
  needsSignIn: false,
  isSessionPending: false,
  isSessionUnavailable: false,
  retryNotice: null,
  isLinkIncomplete: false,
  setFullName: noop,
  setPassword: noop,
  setConfirmPassword: noop,
  submit: noop,
  goToSignIn: noop,
  expand: noop,
  retrySession: noop,
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
    values: { fullName: SAMPLE_NAME, password: SAMPLE_PASSWORD, confirmPassword: SAMPLE_PASSWORD },
  },
};

/** Only the name has been typed. */
export const Partial: Story = {
  args: { ...base, state: 'partial', values: { ...base.values, fullName: SAMPLE_NAME } },
};

/** The invitation was accepted but no session opened: the form is shut, one way out remains. */
export const SessionNotOpened: Story = {
  args: {
    ...base,
    state: 'error',
    canSubmit: false,
    needsSignIn: true,
    notice: { tone: 'violation', message: AUTH.invitation.sessionNotOpened },
  },
};

/** Another account is signed in: accepting will sign it out. */
export const SignedInWarning: Story = {
  args: { ...base, warning: { tone: 'attention', message: AUTH.invitation.signedInWarning } },
};

/** 204 and a live session: the screen is about to open the dashboard. */
export const Success: Story = {
  args: { ...base, state: 'success', isDone: true, canSubmit: false },
};

/** The invitation is dead (missing, malformed, expired or used): the form is gone. */
export const Forbidden: Story = { args: { ...base, state: 'forbidden' } };

/** Folded away, for a host that embeds the screen. */
export const Collapsed: Story = { args: { ...base, state: 'collapsed' } };
