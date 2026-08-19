/**
 * The sign-in screen in each of invariant A11's seven states.
 *
 * Every story renders {@link AuthScreenView} rather than `AuthScreen`, so
 * nothing here needs a gateway, a router or a network — the view is a function
 * of its props, which is the whole point of invariant D's split.
 *
 * The wording is read from `src/i18n/vi.json` rather than retyped, so a story
 * cannot illustrate a sentence the product no longer says.
 */

import type { Meta, StoryObj } from '@storybook/react';

import viMessages from '@/i18n/vi.json';

import { AuthScreenView, type AuthScreenViewProps } from './AuthScreen';
import { LOCKOUT_SECONDS, MIN_PASSWORD_LENGTH } from './useAuthScreen';

const AUTH_MESSAGES = viMessages.auth;

const meta = {
  title: 'Screens/Auth/AuthScreen',
  component: AuthScreenView,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof AuthScreenView>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = (): void => undefined;

const SAMPLE_EMAIL = 'thu.ha@vidu.vn';
const SAMPLE_PASSWORD = 'khong-doan-duoc';

const base: AuthScreenViewProps = {
  state: 'empty',
  tab: 'signIn',
  isCollapsed: false,
  isSubmitting: false,
  values: { email: '', password: '', fullName: '', rememberMe: false },
  problems: {},
  notice: null,
  canSubmit: true,
  submitLabel: AUTH_MESSAGES.actions.signIn,
  isBlocked: false,
  setTab: noop,
  setEmail: noop,
  setPassword: noop,
  setFullName: noop,
  setRememberMe: noop,
  blurField: noop,
  setCollapsed: noop,
  submit: noop,
};

/** Nothing typed yet — the state a visitor arrives in. */
export const Empty: Story = { args: base };

/** The attempt is in flight: the button keeps its width and refuses a second press. */
export const Sending: Story = {
  args: {
    ...base,
    state: 'loading',
    isSubmitting: true,
    canSubmit: false,
    values: { ...base.values, email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD },
  },
};

/** An address has been typed and the password has not. */
export const Partial: Story = {
  args: { ...base, state: 'partial', values: { ...base.values, email: SAMPLE_EMAIL } },
};

/** The server refused the pair. What was typed stays where it was. */
export const WrongPassword: Story = {
  args: {
    ...base,
    state: 'error',
    values: { ...base.values, email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD },
    notice: {
      tone: 'violation',
      title: AUTH_MESSAGES.errors.invalidCredentials.title,
      message: AUTH_MESSAGES.errors.invalidCredentials.description,
    },
  },
};

/** Too many attempts: the strip counts the lockout down and the button is shut. */
export const LockedOut: Story = {
  args: {
    ...base,
    state: 'error',
    canSubmit: false,
    values: { ...base.values, email: SAMPLE_EMAIL },
    notice: {
      tone: 'attention',
      title: AUTH_MESSAGES.errors.tooManyAttempts.title,
      message: AUTH_MESSAGES.errors.tooManyAttempts.description.replace(
        '{{seconds}}',
        String(LOCKOUT_SECONDS),
      ),
    },
  },
};

/** Both fields complained on the way out of them. */
export const FieldProblems: Story = {
  args: {
    ...base,
    state: 'error',
    values: { ...base.values, email: 'thu.ha', password: 'ngan' },
    problems: {
      email: AUTH_MESSAGES.problems.emailInvalid,
      password: AUTH_MESSAGES.problems.passwordTooShort.replace(
        '{{count}}',
        String(MIN_PASSWORD_LENGTH),
      ),
    },
  },
};

/** Signed in. The strip flashes, then the screen changes. */
export const Success: Story = {
  args: {
    ...base,
    state: 'success',
    canSubmit: false,
    values: { ...base.values, email: SAMPLE_EMAIL, password: SAMPLE_PASSWORD },
    notice: { tone: 'verified', message: AUTH_MESSAGES.notices.success },
  },
};

/** The account exists and is not allowed in. The form is gone, not merely disabled. */
export const Forbidden: Story = {
  args: {
    ...base,
    state: 'forbidden',
    isBlocked: true,
    canSubmit: false,
    values: { ...base.values, email: SAMPLE_EMAIL },
    notice: {
      tone: 'attention',
      title: AUTH_MESSAGES.errors.accountDisabled.title,
      message: AUTH_MESSAGES.errors.accountDisabled.description,
    },
  },
};

/** Folded away, for a host that embeds the screen beside something else. */
export const Collapsed: Story = {
  args: { ...base, state: 'collapsed', isCollapsed: true },
};

/** The other tab, with its extra field. */
export const Register: Story = {
  args: { ...base, tab: 'register', submitLabel: AUTH_MESSAGES.actions.register },
};
