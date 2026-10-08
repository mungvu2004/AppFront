/**
 * `/login` — the first screen of the product, and the pattern for the rest.
 *
 * The rendering half of invariant D's split. {@link AuthScreenView} takes plain
 * props and returns markup: it holds no state, calls no gateway, validates
 * nothing and writes no sentence. Every string below arrived from
 * `useAuthScreen`, which is why there is not a user-facing literal in this file
 * and nothing for `local/no-raw-number` to catch.
 *
 * Three decisions worth defending:
 *
 * - **The failure is a strip inside the form, not a toast and not a modal.**
 *   Invariant A9 keeps blocking modals for create, delete and publish, and a
 *   toast for a wrong password would take the message away on a timer while the
 *   person is still reading it. The strip sits above the fields, next to the
 *   thing it is about, and stays until the attempt changes.
 * - **The left column is decoration that costs nothing.** It is a flat sunken
 *   panel with seven hairlines on it — no gradient, no image, no canvas (rule
 *   B). Below 1024 it is gone entirely rather than stacked, because a value
 *   proposition above a login form is something to scroll past on a laptop.
 * - **"Quên mật khẩu" replaces the form, it does not float over it.** There is
 *   no register tab: sign-up is closed in v1. The reset request is a second
 *   panel (`ForgotPasswordPanel`) in the same slot, so Esc means "back" and
 *   focus has one obvious place to return to.
 *
 * All seven of invariant A11's states are rendered from
 * {@link AuthScreenViewProps.state}, and `AuthScreen.test.tsx` renders every one
 * of them through `expectSevenStates`.
 */

import { useCallback, useRef, useState } from 'react';
import { Eye, EyeOff, PanelsTopLeft } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';

/* Nhập THEO TÊN, không default: default export của `vi.json` là một object literal liền
   khối nên Rollup phải giữ cả cuốn từ điển trong chunk vào. Đừng "dọn" về default. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import {
  useAuthScreen,
  type AuthField,
  type AuthScreenActions,
  type AuthScreenModel,
  type UseAuthScreenOptions,
} from './useAuthScreen';
import { ForgotPasswordPanel } from './ForgotPasswordPanel';
import { ValuePanel } from './ValuePanel';

/* -------------------------------------------------------------------------- */
/* The sign-in form.                                                           */
/* -------------------------------------------------------------------------- */

interface CredentialFormProps {
  readonly model: AuthScreenModel;
  readonly actions: AuthScreenActions;
  /** Focuses the first field when the panel mounts, including after a panel change. */
  readonly registerFirstField: (element: HTMLInputElement | null) => void;
}

function CredentialForm({ model, actions, registerFirstField }: CredentialFormProps) {
  const { values, problems, isSubmitting, canSubmit, submitLabel, notice, state } = model;
  const isDone = state === 'success';
  const fieldsDisabled = isSubmitting || isDone;

  /** Ephemeral display state, not part of the model: it changes nothing about what gets submitted. */
  const [isPasswordVisible, setPasswordVisible] = useState(false);

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      actions.submit();
    },
    [actions],
  );

  /**
   * Enter sends from every field, including the checkbox — and only from a field.
   *
   * Implicit form submission already covers the text inputs, but not a focused
   * checkbox, and it is not something jsdom guarantees either. Handling the key
   * here makes the behaviour the same in a browser and in a test, and
   * `preventDefault` is what stops the native submission firing a second time.
   * Enter on a button is that button's own (WCAG 2.1.1), so it is left alone.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key !== 'Enter' || event.defaultPrevented || !(event.target instanceof HTMLInputElement)) {
        return;
      }

      event.preventDefault();
      actions.submit();
    },
    [actions],
  );

  const blur = useCallback(
    (field: AuthField) => () => {
      actions.blurField(field);
    },
    [actions],
  );

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      {/* The reset button goes under the strip, not into its `action` slot: beside the text it
          squeezes the sentence into a ~100 px column at 360 px and below (BUG-003). */}
      {notice !== null && (
        <div className="flex flex-col gap-3">
          <InlineAlert
            level={notice.tone}
            {...(notice.title !== undefined ? { title: notice.title } : {})}
            message={notice.message}
          />
          {notice.showResetAction === true && (
            <Button type="button" variant="secondary" size="sm" className="self-start" onClick={actions.forgotPassword}>
              {AUTH_MESSAGES.actions.resetPassword}
            </Button>
          )}
        </div>
      )}

      {state === 'partial' && (
        <p className="text-[13px] leading-[18px] text-text-secondary">
          {AUTH_MESSAGES.notices.partial}
        </p>
      )}

      <div className="flex flex-col gap-4">
        <Input
          ref={registerFirstField}
          type="email"
          label={AUTH_MESSAGES.fields.email}
          autoComplete="username"
          value={values.email}
          disabled={fieldsDisabled}
          {...(problems.email !== undefined ? { error: problems.email } : {})}
          onChange={(event) => {
            actions.setEmail(event.target.value);
          }}
          onBlur={blur('email')}
        />

        <Input
          type={isPasswordVisible ? 'text' : 'password'}
          label={AUTH_MESSAGES.fields.password}
          autoComplete="current-password"
          value={values.password}
          disabled={fieldsDisabled}
          {...(problems.password !== undefined ? { error: problems.password } : {})}
          onChange={(event) => {
            actions.setPassword(event.target.value);
          }}
          onBlur={blur('password')}
          suffix={
            <button
              type="button"
              disabled={fieldsDisabled}
              onClick={() => {
                setPasswordVisible((visible) => !visible);
              }}
              aria-label={
                isPasswordVisible
                  ? AUTH_MESSAGES.actions.hidePassword
                  : AUTH_MESSAGES.actions.showPassword
              }
              className="text-text-muted transition-colors duration-120 hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPasswordVisible ? (
                <EyeOff aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Eye aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
              )}
            </button>
          }
        />
      </div>

      <div className="flex flex-col gap-4">
        <Checkbox
          label={AUTH_MESSAGES.fields.rememberMe}
          checked={values.rememberMe}
          disabled={fieldsDisabled}
          onChange={actions.setRememberMe}
        />

        {/* `fullWidth` plus a fixed height is what keeps the button the same
            shape while it is sending — the label swaps, the box does not. */}
        <Button type="submit" size="lg" fullWidth loading={isSubmitting} disabled={!canSubmit}>
          {isSubmitting ? AUTH_MESSAGES.actions.submitting : submitLabel}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-px flex-1 bg-border-default" />
          <span className="text-[13px] leading-[18px] text-text-muted">{AUTH_MESSAGES.actions.or}</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border-default" />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          disabled={fieldsDisabled}
          onClick={actions.ssoSignIn}
        >
          {AUTH_MESSAGES.actions.ssoSignIn}
        </Button>

        <button
          type="button"
          disabled={fieldsDisabled}
          onClick={actions.forgotPassword}
          className="self-center text-[13px] leading-[18px] text-accent transition-colors duration-120 hover:text-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {AUTH_MESSAGES.actions.forgotPassword}
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* The view.                                                                   */
/* -------------------------------------------------------------------------- */

export type AuthScreenViewProps = AuthScreenModel &
  AuthScreenActions & {
    /**
     * Leaves the disabled-account strip for an empty sign-in form (BUG-017). Optional until
     * `useAuthScreen` owns the reset (it has to clear `failure`); no button without it.
     */
    readonly signInWithAnotherAccount?: () => void;
  };

/**
 * The screen as a function of its props.
 *
 * Rendered directly by tests and stories, one call per state, which is what
 * lets all seven be checked without a gateway or a router.
 */
export function AuthScreenView(props: AuthScreenViewProps) {
  const { state, panel, isCollapsed, notice, isBlocked, forgot, forgotActions } = props;
  const { setCollapsed, forgotPassword, closeForgotPassword, signInWithAnotherAccount } = props;

  const model: AuthScreenModel = props;
  const actions: AuthScreenActions = props;

  /**
   * True until the first field of the freshly mounted panel has been focused.
   *
   * A callback ref rather than an effect: the field mounts with its panel, so at
   * the moment an effect keyed on `panel` would run there is nothing to focus
   * yet. Both panels hand the same ref to their email box, which is what makes
   * "open the panel" and "back to sign in" each land on an email field.
   */
  const wantsFocus = useRef(true);

  const registerFirstField = useCallback((element: HTMLInputElement | null) => {
    if (element !== null && wantsFocus.current) {
      wantsFocus.current = false;
      element.focus();
    }
  }, []);

  const openForgot = useCallback(() => {
    wantsFocus.current = true;
    forgotPassword();
  }, [forgotPassword]);

  const closeForgot = useCallback(() => {
    wantsFocus.current = true;
    closeForgotPassword();
  }, [closeForgotPassword]);

  const expand = useCallback(() => {
    wantsFocus.current = true;
    setCollapsed(false);
  }, [setCollapsed]);

  const reopenForm = useCallback(() => {
    wantsFocus.current = true;
    signInWithAnotherAccount?.();
  }, [signInWithAnotherAccount]);

  const isForgot = panel === 'forgotPassword';

  return (
    /* Which of the seven states the screen is in, as an attribute rather than
       as text. ShareScreen prints it into an `sr-only` span; that announces an
       English word — "partial" — to a Vietnamese screen-reader user, and the
       strip below already says the same thing in a sentence. A `data-`
       attribute is readable by a test and silent to everyone else. */
    <main className="flex min-h-screen w-full bg-bg-app" data-auth-state={state}>
      <ValuePanel />

      {/* Anchored from the top, not centred: centred, every strip that appears lifts the whole form
          and the field being typed in slides out from under the caret (BUG-008). The top padding
          puts the empty form where centring used to — 17.5rem is about half its height. */}
      <div className="flex w-full flex-col items-center p-12 pt-[max(3rem,calc(50vh_-_17.5rem))] lg:w-[55%]">
        <div className="flex w-[360px] max-w-full flex-col gap-6 animate-panel-rise motion-reduce:animate-none">
          {/* The mark, and the screen's own name beside it. There is deliberately
              no "thu gọn" button: `isCollapsed` is set by whoever mounts the
              screen — an embedding host with less room — not by the visitor. A
              control on a product screen whose only job is to switch it into
              another of its seven states is the developer furniture list B
              refuses, and it belongs on /design-system/states instead. */}
          <div className="flex flex-col gap-3">
            <PanelsTopLeft aria-hidden="true" className="h-8 w-8 text-accent" strokeWidth={1.5} />
            <div className="flex flex-col gap-1">
              <h1 className="text-[30px] font-semibold leading-[40px] text-text-primary">
                {isForgot ? AUTH_MESSAGES.forgotPassword.title : AUTH_MESSAGES.tabs.signIn}
              </h1>
              <p className="text-[15px] leading-[24px] text-text-secondary">
                {isForgot ? AUTH_MESSAGES.forgotPassword.subtitle : AUTH_MESSAGES.brand.subtitle}
              </p>
            </div>
          </div>

          {isCollapsed ? (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] leading-[20px] text-text-secondary">
                {AUTH_MESSAGES.notices.collapsed}
              </p>
              <Button size="lg" fullWidth onClick={expand}>
                {AUTH_MESSAGES.actions.expand}
              </Button>
            </div>
          ) : isForgot ? (
            <div key={panel} className="animate-dropdown-open motion-reduce:animate-none">
              <ForgotPasswordPanel
                model={forgot}
                actions={forgotActions}
                onBack={closeForgot}
                registerEmailField={registerFirstField}
              />
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col gap-4">
              <InlineAlert
                level={notice?.tone ?? 'attention'}
                title={notice?.title ?? AUTH_MESSAGES.errors.accountDisabled.title}
                message={notice?.message ?? AUTH_MESSAGES.errors.accountDisabled.description}
              />
              {signInWithAnotherAccount !== undefined && (
                <Button type="button" variant="secondary" size="lg" fullWidth onClick={reopenForm}>
                  {AUTH_MESSAGES.actions.signInWithAnotherAccount}
                </Button>
              )}
            </div>
          ) : (
            <div key={panel} className="animate-dropdown-open motion-reduce:animate-none">
              <CredentialForm
                model={model}
                actions={{ ...actions, forgotPassword: openForgot }}
                registerFirstField={registerFirstField}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* The screen.                                                                 */
/* -------------------------------------------------------------------------- */

export type AuthScreenProps = UseAuthScreenOptions;

/**
 * The view, wired to its logic.
 *
 * @example
 * <AuthScreen gateway={gateway} onAuthenticated={() => navigate(from)} />
 */
export function AuthScreen(props: AuthScreenProps) {
  const { model, actions } = useAuthScreen(props);

  return <AuthScreenView {...model} {...actions} />;
}
