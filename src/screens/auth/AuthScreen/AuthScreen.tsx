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
 * - **Both tabs render their own form.** They could share one and swap a field,
 *   but `Tabs.Panel` unmounts the outgoing panel, and a single shared form would
 *   keep the register tab's "họ và tên" complaint mounted under the sign-in
 *   tab. Two panels, one subcomponent, no leakage.
 *
 * All seven of invariant A11's states are rendered from
 * {@link AuthScreenViewProps.state}, and `AuthScreen.test.tsx` renders every one
 * of them through `expectSevenStates`.
 */

import { useCallback, useRef } from 'react';
import { PanelsTopLeft } from 'lucide-react';

import { InlineAlert } from '@/components/feedback/InlineAlert';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';

import viMessages from '@/i18n/vi.json';

import {
  useAuthScreen,
  type AuthField,
  type AuthScreenActions,
  type AuthScreenModel,
  type AuthTab,
  type UseAuthScreenOptions,
} from './useAuthScreen';

const AUTH_MESSAGES = viMessages.auth;

/** The one panel both tabs point at. Fixed, because there is only ever one. */
const PANEL_ID = 'auth-tab-panel';

/** Where the hairlines sit on the left panel. Static: nothing here moves or measures. */
const VERTICAL_RULE_OFFSETS = ['18%', '36%', '54%', '72%', '90%'] as const;
const HORIZONTAL_RULE_OFFSETS = ['28%', '64%'] as const;

/* -------------------------------------------------------------------------- */
/* The left column.                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The value proposition, on a grid that is drawn rather than rendered.
 *
 * `aria-hidden` on the rules because they are texture: a screen reader that
 * announced seven dividers before the form would be describing the wallpaper.
 */
function ValuePanel() {
  return (
    <section className="relative hidden w-[45%] shrink-0 overflow-hidden bg-bg-sunken p-12 lg:flex lg:flex-col lg:justify-center">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {VERTICAL_RULE_OFFSETS.map((offset) => (
          <span
            key={offset}
            className="absolute top-0 bottom-0 w-px bg-border-default"
            style={{ left: offset }}
          />
        ))}
        {HORIZONTAL_RULE_OFFSETS.map((offset) => (
          <span
            key={offset}
            className="absolute right-0 left-0 h-px bg-border-default"
            style={{ top: offset }}
          />
        ))}
      </div>

      <div className="relative flex max-w-[420px] flex-col gap-4">
        <h1 className="text-[28px] font-semibold leading-[36px] text-text-primary">
          {AUTH_MESSAGES.hero.headline}
        </h1>
        <p className="text-[15px] leading-[24px] text-text-secondary">
          {AUTH_MESSAGES.hero.support}
        </p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* One tab's form.                                                             */
/* -------------------------------------------------------------------------- */

interface CredentialFormProps {
  readonly tab: AuthTab;
  readonly model: AuthScreenModel;
  readonly actions: AuthScreenActions;
  /** Focuses the first field when the panel mounts, including after a tab change. */
  readonly registerFirstField: (element: HTMLInputElement | null) => void;
}

function CredentialForm({ tab, model, actions, registerFirstField }: CredentialFormProps) {
  const { values, problems, isSubmitting, canSubmit, submitLabel, notice, state } = model;
  const isRegister = tab === 'register';
  const isDone = state === 'success';
  const fieldsDisabled = isSubmitting || isDone;

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      actions.submit();
    },
    [actions],
  );

  /**
   * Enter sends from every field, including the checkbox.
   *
   * Implicit form submission already covers the text inputs, but not a focused
   * checkbox, and it is not something jsdom guarantees either. Handling the key
   * here makes the behaviour the same in a browser and in a test, and
   * `preventDefault` is what stops the native submission firing a second time.
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key !== 'Enter' || event.defaultPrevented) {
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
      {notice !== null && (
        <InlineAlert
          level={notice.tone}
          {...(notice.title !== undefined ? { title: notice.title } : {})}
          message={notice.message}
        />
      )}

      {state === 'partial' && (
        <p className="text-[13px] leading-[18px] text-text-secondary">
          {AUTH_MESSAGES.notices.partial}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {isRegister && (
          <Input
            ref={registerFirstField}
            label={AUTH_MESSAGES.fields.fullName}
            autoComplete="name"
            value={values.fullName}
            disabled={fieldsDisabled}
            {...(problems.fullName !== undefined ? { error: problems.fullName } : {})}
            onChange={(event) => {
              actions.setFullName(event.target.value);
            }}
            onBlur={blur('fullName')}
          />
        )}

        <Input
          {...(isRegister ? {} : { ref: registerFirstField })}
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
          type="password"
          label={AUTH_MESSAGES.fields.password}
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={values.password}
          disabled={fieldsDisabled}
          {...(problems.password !== undefined ? { error: problems.password } : {})}
          onChange={(event) => {
            actions.setPassword(event.target.value);
          }}
          onBlur={blur('password')}
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
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* The view.                                                                   */
/* -------------------------------------------------------------------------- */

export type AuthScreenViewProps = AuthScreenModel & AuthScreenActions;

/**
 * The screen as a function of its props.
 *
 * Rendered directly by tests and stories, one call per state, which is what
 * lets all seven be checked without a gateway or a router.
 */
export function AuthScreenView(props: AuthScreenViewProps) {
  const { state, tab, isCollapsed, notice, isBlocked, setTab, setCollapsed } = props;

  const model: AuthScreenModel = props;
  const actions: AuthScreenActions = props;

  /**
   * True until the first field of the freshly mounted panel has been focused.
   *
   * A callback ref rather than an effect because `Tabs.Panel` mounts the
   * incoming panel only after the outgoing one has finished leaving, so at the
   * moment an effect keyed on `tab` would run there is no input to focus yet.
   */
  const wantsFocus = useRef(true);

  const registerFirstField = useCallback((element: HTMLInputElement | null) => {
    if (element !== null && wantsFocus.current) {
      wantsFocus.current = false;
      element.focus();
    }
  }, []);

  const handleTabChange = useCallback(
    (next: string) => {
      wantsFocus.current = true;
      setTab(next === 'register' ? 'register' : 'signIn');
    },
    [setTab],
  );

  const expand = useCallback(() => {
    wantsFocus.current = true;
    setCollapsed(false);
  }, [setCollapsed]);

  return (
    /* Which of the seven states the screen is in, as an attribute rather than
       as text. ShareScreen prints it into an `sr-only` span; that announces an
       English word — "partial" — to a Vietnamese screen-reader user, and the
       strip below already says the same thing in a sentence. A `data-`
       attribute is readable by a test and silent to everyone else. */
    <main className="flex min-h-screen w-full bg-bg-app" data-auth-state={state}>
      <ValuePanel />

      <div className="flex w-full flex-col items-center justify-center p-12 lg:w-[55%]">
        <div className="flex w-[360px] max-w-full flex-col gap-6">
          {/* The mark, and nothing beside it. There is deliberately no "thu
              gọn" button: `isCollapsed` is set by whoever mounts the screen —
              an embedding host with less room — not by the visitor. A control
              on a product screen whose only job is to switch it into another of
              its seven states is the developer furniture list B refuses, and it
              belongs on /design-system/states instead. */}
          <PanelsTopLeft aria-hidden="true" className="h-7 w-7 text-accent" strokeWidth={1.5} />

          {isCollapsed ? (
            <div className="flex flex-col gap-4">
              <p className="text-[14px] leading-[20px] text-text-secondary">
                {AUTH_MESSAGES.notices.collapsed}
              </p>
              <Button size="lg" fullWidth onClick={expand}>
                {AUTH_MESSAGES.actions.expand}
              </Button>
            </div>
          ) : isBlocked ? (
            <InlineAlert
              level={notice?.tone ?? 'attention'}
              title={notice?.title ?? AUTH_MESSAGES.errors.accountDisabled.title}
              message={notice?.message ?? AUTH_MESSAGES.errors.accountDisabled.description}
            />
          ) : (
            <Tabs.Root activeId={tab} onChange={handleTabChange}>
              <Tabs.List aria-label={AUTH_MESSAGES.tabs.signIn}>
                <Tabs.Tab id="signIn" aria-controls={PANEL_ID}>
                  {AUTH_MESSAGES.tabs.signIn}
                </Tabs.Tab>
                <Tabs.Tab id="register" aria-controls={PANEL_ID}>
                  {AUTH_MESSAGES.tabs.register}
                </Tabs.Tab>
              </Tabs.List>

              {/* The form sits beside `Tabs.Panel`, not inside it.
                  `Tabs.Panel` wraps its child in an `AnimatePresence` with
                  `mode="wait"`, which holds the outgoing panel mounted until
                  its exit animation reports back and only then mounts the
                  incoming one. When that report does not arrive the form is
                  simply gone — the screen renders a tab strip over nothing, and
                  a login screen with no fields is the worst failure this one
                  has. Trading a crossfade for a form that is always mounted is
                  not a close call. The 180 ms of invariant B is still there:
                  `Tabs.Tab` slides its 2px underline at `fast`, and the panel
                  replays the same-length entry animation because `key` changes
                  with the tab.

                  The cost is that `aria-controls` on both tabs points at one
                  panel rather than one each, so the panel is named rather than
                  labelled by its tab. */}
              <div
                key={tab}
                id={PANEL_ID}
                role="tabpanel"
                aria-label={
                  tab === 'register' ? AUTH_MESSAGES.tabs.register : AUTH_MESSAGES.tabs.signIn
                }
                className="relative pt-6 animate-dropdown-open motion-reduce:animate-none"
              >
                <CredentialForm
                  tab={tab}
                  model={model}
                  actions={actions}
                  registerFirstField={registerFirstField}
                />
              </div>
            </Tabs.Root>
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
