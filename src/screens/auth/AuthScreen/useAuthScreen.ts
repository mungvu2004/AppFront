/**
 * Everything the sign-in screen knows, with nothing it can draw.
 *
 * The logic half of invariant D's split. It owns the two field values, which of
 * the two panels (sign in, forgot password) is open, what the last attempt did, and which of invariant A11's
 * seven states all of that adds up to. It returns strings that are already
 * written and booleans that are already decided, so `AuthScreen.tsx` can be a
 * function from props to markup with no branch of its own worth testing.
 *
 * Three decisions worth defending:
 *
 * - **The transport is a port, not an import.** {@link AuthGateway} is two
 *   async functions handed in by the container. That is what lets the whole
 *   screen — including its failure paths — be tested without a network, a
 *   router or a configured session. The schemas below come from `src/api`
 *   because a *shape* is a value with no behaviour; a *client* is not, and that
 *   is the one this file never reaches for.
 * - **Sentences come from the bundle, never from here.** Field complaints and
 *   the three auth-specific failures are read out of `src/i18n/vi.json` under
 *   `auth.*`; anything else that can go wrong on the wire is handed to
 *   `describeError` from `src/lib/errors`, which is the module that owns the
 *   product's error wording. There is not a user-facing sentence literal below.
 * - **A rejected attempt keeps what was typed.** `email` and `password` are not
 *   cleared on failure and not cleared when the panel changes. Retyping an address
 *   because the server said no is the failure this screen exists to avoid.
 *
 * ## Where the field rules live
 *
 * In `src/api/schemas`, with every other schema (R-61, R-69). This file used to
 * declare its own, back when that module had no credential schemas to call; it
 * re-exports them now so the screen's public surface is unchanged, and holds
 * none of its own. What stays here is the *mapping* from a failed check to the
 * sentence a person reads, because the shape belongs to the data layer and the
 * wording belongs to `vi.json`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

import {
  EmailSchema,
  MAX_EMAIL_LENGTH,
  MIN_PASSWORD_LENGTH,
  PasswordSchema,
  SignInSchema,
  type SignInInput,
} from '@/api/schemas';
import { describeError, toAppError } from '@/lib/errors';
import { readWireError } from '@/lib/errors/wireError';
import type { Result } from '@/lib/http';
import { durationMs } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

/* Nhập THEO TÊN, không default: default export của `vi.json` là một object literal liền
   khối nên Rollup phải giữ cả cuốn từ điển trong chunk vào. Đừng "dọn" về default. */
import { auth as AUTH_MESSAGES } from '@/i18n/vi.json';

import { fillTemplate, RECOVERY_LOCKOUT_SECONDS } from '../recoveryShared';
import { useLockout } from '../useLockout';

import {
  useForgotPassword,
  type ForgotPasswordActions,
  type ForgotPasswordModel,
} from './useForgotPassword';

export { MIN_PASSWORD_LENGTH, SignInSchema };
export type { SignInInput };

/* -------------------------------------------------------------------------- */
/* Wording.                                                                    */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* The port.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The calls this screen makes, and the only way it reaches a network.
 *
 * Returning a `Result` rather than throwing keeps the failure path ordinary: a
 * rejected password is a value this hook classifies, not an exception it has to
 * catch in three places.
 */
export interface AuthGateway {
  readonly signIn: (input: SignInInput, signal?: AbortSignal) => Promise<Result<void, unknown>>;
  readonly requestPasswordReset: (
    input: { readonly email: string },
    signal?: AbortSignal,
  ) => Promise<Result<void, unknown>>;
}

/**
 * Đăng nhập xong, cookie đã nhận, nhưng phiên chưa mở vì máy chủ không trả lời lượt
 * gia hạn (`serverUnreachable`). Không phải sai mật khẩu và không phải lỗi mạng của
 * lượt gửi. Tầng phiên KHÔNG chắc tự thử lại (phiên đang `anonymous` thì nó đứng im,
 * `refresh.ts` `handleTransientFailure`), nên nút Đăng nhập vẫn bấm được để người dùng
 * tự thử lại (BUG-013). Container ném nó để hook nói đúng câu.
 */
export class SignedInOfflineError extends Error {
  constructor() {
    super('Signed in, but the server could not be reached to open the session.');
    this.name = 'SignedInOfflineError';
  }
}

/**
 * Máy chủ nhận mật khẩu nhưng lượt gia hạn ngay sau đó không mở được phiên (vd. trình
 * duyệt chặn cookie). Một lớp riêng để hook nói đúng chuyện, thay vì để `toAppError` đoán
 * theo chữ tiếng Anh trong `message` và ra "Phiên làm việc đã hết hạn" (BUG-014).
 */
export class SessionNotOpenedError extends Error {
  constructor() {
    super('Sign-in succeeded but no session was established.');
    this.name = 'SessionNotOpenedError';
  }
}

/* -------------------------------------------------------------------------- */
/* Shapes the view reads.                                                      */
/* -------------------------------------------------------------------------- */

/** Which panel is open: the sign-in form, or the "forgot password" one that replaces it. */
export type AuthPanel = 'signIn' | 'forgotPassword';

/** A sentence the host asks the strip to open with. */
export type AuthInitialNotice = 'passwordReset' | 'sessionEnded' | 'signInRequired';

/** The two fields, by the name the view labels them under. */
export type AuthField = 'email' | 'password';

/** The state colours invariant A4 allows. Named here so the hook stays free of components. */
export type AuthNoticeTone = 'verified' | 'attention' | 'violation';

/** A sentence the form shows in its own strip — never a toast, never a modal (A9). */
export interface AuthNotice {
  readonly tone: AuthNoticeTone;
  /** Absent when the message says the whole thing on its own. */
  readonly title?: string;
  readonly message: string;
  /** True only for a wrong password: the one failure a person can act on right away. */
  readonly showResetAction?: boolean;
  /** A way out the strip offers on its own — today only "already signed in" (BUG-006). */
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

/** A complaint under one field, or nothing when the field is fine. */
export type AuthProblems = Partial<Readonly<Record<AuthField, string>>>;

/** Everything typed into the form. */
export interface AuthValues {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
}

/** What the view renders from. Every field is decided; none needs interpreting. */
export interface AuthScreenModel {
  readonly state: SevenState;
  readonly panel: AuthPanel;
  readonly forgot: ForgotPasswordModel;
  readonly isCollapsed: boolean;
  readonly isSubmitting: boolean;
  readonly values: AuthValues;
  readonly problems: AuthProblems;
  /** The strip inside the form. Null when the last attempt has nothing to say. */
  readonly notice: AuthNotice | null;
  /** False while submitting, while locked out, and while the account is disabled. */
  readonly canSubmit: boolean;
  /** The primary button's label. Keeps its width while submitting, so it does not change. */
  readonly submitLabel: string;
  /** True once the account is known to be disabled: the form is gone for good. */
  readonly isBlocked: boolean;
}

/** What the view can do. Every one is stable across renders. */
export interface AuthScreenActions {
  readonly setEmail: (email: string) => void;
  readonly setPassword: (password: string) => void;
  readonly setRememberMe: (rememberMe: boolean) => void;
  /** Validates one field, on the way out of it. */
  readonly blurField: (field: AuthField) => void;
  readonly setCollapsed: (isCollapsed: boolean) => void;
  readonly submit: () => void;
  /**
   * The SSO button. Absent — and the button with it — until a host supplies
   * {@link UseAuthScreenOptions.onSsoSignIn}: a button that does nothing is a dead end (BUG-002).
   */
  readonly ssoSignIn?: () => void;
  /** "Quên mật khẩu": opens the panel, carrying the address typed so far. */
  readonly forgotPassword: () => void;
  /** Back to the sign-in form. */
  readonly closeForgotPassword: () => void;
  /**
   * "Đăng nhập bằng tài khoản khác" on the disabled-account strip: clears the failure and the
   * password, keeps the address, and the form comes back (BUG-017).
   */
  readonly signInWithAnotherAccount: () => void;
  readonly forgotActions: ForgotPasswordActions;
}

export interface UseAuthScreenOptions {
  readonly gateway: AuthGateway;
  /** Called after the success flash, to send the visitor back where they came from. */
  readonly onAuthenticated: () => void;
  /** There is no SSO flow yet — without this the screen shows no SSO button at all. */
  readonly onSsoSignIn?: () => void;
  /** A sentence to open the strip with — what the last screen wants this one to say. */
  readonly initialNotice?: AuthInitialNotice;
  /**
   * Present when a session is already open: the strip says so — signing in again replaces
   * it — and offers this as the way back (BUG-006). The form stays usable.
   */
  readonly onReturnToApp?: () => void;
  /** Skips the success flash, so a person who asked for less motion waits for nothing. */
  readonly reducedMotion?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Failures.                                                                   */
/* -------------------------------------------------------------------------- */

/** How long the server locks an address out for, when it does not say. */
export const LOCKOUT_SECONDS = RECOVERY_LOCKOUT_SECONDS;

const TOO_MANY_REQUESTS_STATUS = 429;

/** What the server said, reduced to the cases this screen answers differently. */
type AuthFailure =
  | { readonly kind: 'invalidCredentials' }
  | { readonly kind: 'accountDisabled' }
  | { readonly kind: 'originMismatch' }
  | { readonly kind: 'tooManyAttempts' }
  | { readonly kind: 'validation' }
  | { readonly kind: 'validationOther' }
  | { readonly kind: 'signedInOffline' }
  | { readonly kind: 'sessionNotOpened' }
  | { readonly kind: 'transport'; readonly cause: unknown };

/**
 * A failed sign-in, read by the wire `code` and not by the status alone (HOP-DONG-MOI §3).
 *
 * A bare 403 is NOT "account disabled": `ORIGIN_MISMATCH` is a deployment fault and
 * says so on its own. 429 is read by status, with or without a code, and the lockout
 * is {@link LOCKOUT_SECONDS} whatever `Retry-After` says — the server counts failures
 * for 900 s and locks every later attempt for 60, so a short header would lie.
 * `field` errors come back as the problem under that box, not as a strip.
 */
function classifyFailure(error: unknown): { failure: AuthFailure; field?: AuthField } {
  if (error instanceof SignedInOfflineError) {
    return { failure: { kind: 'signedInOffline' } };
  }

  if (error instanceof SessionNotOpenedError) {
    return { failure: { kind: 'sessionNotOpened' } };
  }

  const wire = readWireError(error);

  if (wire?.status === TOO_MANY_REQUESTS_STATUS || wire?.code === 'RATE_LIMITED') {
    return { failure: { kind: 'tooManyAttempts' } };
  }

  switch (wire?.code) {
    case 'INVALID_CREDENTIALS':
      return { failure: { kind: 'invalidCredentials' } };
    case 'ACCOUNT_DISABLED':
      return { failure: { kind: 'accountDisabled' } };
    case 'ORIGIN_MISMATCH':
      return { failure: { kind: 'originMismatch' } };
    case 'VALIDATION':
      if (wire.field === 'email' || wire.field === 'password') {
        return { failure: { kind: 'validation' }, field: wire.field };
      }

      // No box to mark, so not the generic "các trường được đánh dấu" (BUG-018).
      return { failure: { kind: 'validationOther' } };
    default:
      return { failure: { kind: 'transport', cause: error } };
  }
}

/**
 * A failure as the strip will read it.
 *
 * The auth-specific cases come from `auth.errors.*`, because "sai mật khẩu"
 * is wording this screen owns. Everything else — no network, a timeout, a
 * gateway that fell over, a code nobody here knows — goes to `describeError`,
 * which owns the rest of the product's error wording, so a dropped connection
 * reads the same here as it does anywhere else and no raw code reaches a person.
 */
function noticeFor(failure: AuthFailure): AuthNotice | null {
  switch (failure.kind) {
    case 'invalidCredentials':
      return {
        tone: 'violation',
        title: AUTH_MESSAGES.errors.invalidCredentials.title,
        message: AUTH_MESSAGES.errors.invalidCredentials.description,
        showResetAction: true,
      };
    case 'accountDisabled':
      return {
        tone: 'attention',
        title: AUTH_MESSAGES.errors.accountDisabled.title,
        message: AUTH_MESSAGES.errors.accountDisabled.description,
      };
    case 'originMismatch':
      return {
        tone: 'violation',
        title: AUTH_MESSAGES.errors.originMismatch.title,
        message: AUTH_MESSAGES.errors.originMismatch.description,
      };
    case 'tooManyAttempts':
      return {
        tone: 'attention',
        title: AUTH_MESSAGES.errors.tooManyAttempts.title,
        message: AUTH_MESSAGES.errors.tooManyAttempts.description,
      };
    case 'signedInOffline':
      return { tone: 'attention', message: AUTH_MESSAGES.notices.signedInOffline };
    case 'sessionNotOpened':
      return { tone: 'attention', message: AUTH_MESSAGES.notices.sessionNotOpened };
    case 'validationOther':
      return {
        tone: 'violation',
        title: AUTH_MESSAGES.errors.validationOther.title,
        message: AUTH_MESSAGES.errors.validationOther.description,
      };
    case 'validation':
      return null;
    default: {
      const described = describeError(toAppError(failure.cause));

      return { tone: 'violation', title: described.title, message: described.description };
    }
  }
}

/** What the strip opens with when the previous screen asked for it. */
const INITIAL_NOTICES: Readonly<Record<AuthInitialNotice, AuthNotice>> = {
  passwordReset: { tone: 'verified', message: AUTH_MESSAGES.notices.passwordReset },
  sessionEnded: { tone: 'attention', message: AUTH_MESSAGES.notices.sessionEnded },
  signInRequired: { tone: 'attention', message: AUTH_MESSAGES.notices.signInRequired },
};

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What each field says when it is simply not filled in.
 */
const MISSING_BY_FIELD: Readonly<Record<AuthField, string>> = {
  email: AUTH_MESSAGES.problems.emailRequired,
  password: AUTH_MESSAGES.problems.passwordRequired,
};

/**
 * A failed check, as a sentence.
 *
 * The schemas in `src/api/schemas` carry no messages — they describe a shape,
 * and a shape has no language. This is where a shape that did not hold becomes
 * something a person can act on, and the three cases worth telling apart from
 * "chưa nhập" are the only three the schemas can produce:
 *
 * - `invalid_string`, which only `EmailSchema` can raise, and only for the
 *   address format.
 * - `too_big`, which only `EmailSchema` can raise: an address past
 *   {@link MAX_EMAIL_LENGTH}, which the server would refuse as "invalid".
 * - `too_small` at exactly {@link MIN_PASSWORD_LENGTH}, which is the password
 *   being short rather than absent. An empty box raises `too_small` too, at a
 *   minimum of one, and falls through to the missing sentence — which is why
 *   the `.min(1)` in `PasswordSchema` is declared before the `.min(8)`.
 */
function sentenceFor(field: AuthField, issue: z.ZodIssue): string {
  if (issue.code === 'invalid_string') {
    return AUTH_MESSAGES.problems.emailInvalid;
  }

  if (issue.code === 'too_big') {
    return fillTemplate(AUTH_MESSAGES.problems.emailTooLong, { count: String(MAX_EMAIL_LENGTH) });
  }

  if (issue.code === 'too_small' && issue.minimum === MIN_PASSWORD_LENGTH) {
    return fillTemplate(AUTH_MESSAGES.problems.passwordTooShort, {
      count: String(MIN_PASSWORD_LENGTH),
    });
  }

  return MISSING_BY_FIELD[field];
}

/** The first complaint a schema has about one value, or nothing. */
function firstProblem(field: AuthField, value: unknown): string | undefined {
  const parsed = SCHEMA_BY_FIELD[field].safeParse(value);

  if (parsed.success) {
    return undefined;
  }

  const issue = parsed.error.issues[0];

  return issue === undefined ? undefined : sentenceFor(field, issue);
}

/** The fields the sign-in form asks for. */
const FIELDS: readonly AuthField[] = ['email', 'password'];

const SCHEMA_BY_FIELD: Readonly<Record<AuthField, z.ZodType<unknown>>> = {
  email: EmailSchema,
  password: PasswordSchema,
};

function valueOf(values: AuthValues, field: AuthField): string {
  return field === 'email' ? values.email : values.password;
}

/* -------------------------------------------------------------------------- */
/* The hook.                                                                   */
/* -------------------------------------------------------------------------- */

/** The seven states as the "forgot password" panel reads them: sending, sent, failed, typed, empty. */
function forgotStateOf(forgot: ForgotPasswordModel): SevenState {
  if (forgot.isSending) {
    return 'loading';
  }
  if (forgot.isSent) {
    return 'success';
  }
  if (forgot.hasFailure) {
    return 'error';
  }

  return forgot.email.length > 0 ? 'partial' : 'empty';
}

/** What the last attempt left behind. */
type Phase = 'idle' | 'submitting' | 'succeeded';

const EMPTY_VALUES: AuthValues = { email: '', password: '', rememberMe: false };

/**
 * The sign-in screen's state, decisions and wording.
 *
 * @example
 * const { model, actions } = useAuthScreen({ gateway, onAuthenticated: goBack });
 * return <AuthScreenView {...model} {...actions} />;
 */
export function useAuthScreen(options: UseAuthScreenOptions): {
  readonly model: AuthScreenModel;
  readonly actions: AuthScreenActions;
} {
  const {
    gateway,
    onAuthenticated,
    onSsoSignIn,
    initialNotice,
    onReturnToApp,
    reducedMotion = false,
  } = options;

  const [panel, setPanel] = useState<AuthPanel>('signIn');
  /** The host's opening sentence; the first attempt replaces it. */
  const [openingNotice, setOpeningNotice] = useState<AuthInitialNotice | undefined>(initialNotice);
  const { model: forgot, actions: forgotActions } = useForgotPassword({
    request: gateway.requestPasswordReset,
  });
  const [values, setValues] = useState<AuthValues>(EMPTY_VALUES);
  const [problems, setProblems] = useState<AuthProblems>({});
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [isCollapsed, setCollapsedState] = useState(false);
  const { isLocked: isLockedOut, lock } = useLockout();

  /**
   * Guards the double submit.
   *
   * `phase` alone cannot: two Enter presses in the same tick both read the state
   * from before either of them, and both would post. A ref is written
   * synchronously, so the second press sees the first.
   */
  const inFlight = useRef(false);
  /** Cleared on unmount, so a screen that navigates away does not flash into nothing. */
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Read inside the flash timer, so a re-rendered callback does not go stale. */
  const onAuthenticatedRef = useRef(onAuthenticated);

  /**
   * The current values, readable synchronously.
   *
   * `submit` and `blurField` need what is in the fields *now*, and both do more
   * than compute a next state — they post a request, they set a second piece of
   * state. Doing that inside a `setValues` updater would run it twice under
   * StrictMode's double invocation, which for `submit` means two sign-in
   * attempts. A mirror ref keeps the read synchronous and the writes outside.
   */
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(
    () => () => {
      if (flashTimer.current !== null) {
        clearTimeout(flashTimer.current);
      }
    },
    [],
  );

  /* ---- the lockout countdown --------------------------------------------- */

  /** The lockout is over the moment the count reaches zero; the strip goes with it. */
  useEffect(() => {
    if (!isLockedOut) {
      setFailure((current) => (current?.kind === 'tooManyAttempts' ? null : current));
    }
  }, [isLockedOut]);

  /* ---- editing ------------------------------------------------------------ */

  /** Typing clears that field's complaint: a person fixing a value should see it settle. */
  const editField = useCallback((field: AuthField, patch: Partial<AuthValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setProblems((current) => {
      if (current[field] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[field];

      return next;
    });
  }, []);

  const setEmail = useCallback(
    (email: string) => {
      editField('email', { email });
    },
    [editField],
  );

  const setPassword = useCallback(
    (password: string) => {
      editField('password', { password });
    },
    [editField],
  );

  const setRememberMe = useCallback((rememberMe: boolean) => {
    setValues((current) => ({ ...current, rememberMe }));
  }, []);

  const blurField = useCallback((field: AuthField) => {
    const value = valueOf(valuesRef.current, field);

    // An empty box is "chưa nhập" only at submit (BUG-009): the page focuses the email box on
    // load, so complaining on blur pushed the links below down under the visitor's first click.
    if (value.length === 0) {
      return;
    }

    const problem = firstProblem(field, value);

    setProblems((current) => {
      if (problem === undefined) {
        if (current[field] === undefined) {
          return current;
        }

        const next = { ...current };
        delete next[field];

        return next;
      }

      return { ...current, [field]: problem };
    });
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
  }, []);

  /** Opening the panel carries the address typed so far; closing it keeps that address. */
  const forgotPassword = useCallback(() => {
    forgotActions.reset(valuesRef.current.email);
    setPanel('forgotPassword');
  }, [forgotActions]);

  const closeForgotPassword = useCallback(() => {
    setPanel('signIn');
  }, []);

  const signInWithAnotherAccount = useCallback(() => {
    setFailure(null);
    setValues((current) => ({ ...current, password: '' }));
    setProblems({});
  }, []);

  /* ---- submitting --------------------------------------------------------- */

  const isBlocked = failure?.kind === 'accountDisabled';

  const submit = useCallback(() => {
    if (inFlight.current || isBlocked || isLockedOut) {
      return;
    }

    const current = valuesRef.current;
    // Mutable while it is being filled; handed to `setProblems` as the readonly
    // shape the view sees.
    const found: Partial<Record<AuthField, string>> = {};

    for (const field of FIELDS) {
      const problem = firstProblem(field, valueOf(current, field));

      if (problem !== undefined) {
        found[field] = problem;
      }
    }

    if (Object.keys(found).length > 0) {
      setProblems(found);

      return;
    }

    setProblems({});
    setFailure(null);
    setOpeningNotice(undefined);
    inFlight.current = true;
    setPhase('submitting');

    void gateway
      .signIn({
        email: current.email,
        password: current.password,
        rememberMe: current.rememberMe,
      })
      .then((result) => {
        inFlight.current = false;

        if (result.ok) {
          setPhase('succeeded');

          if (reducedMotion) {
            onAuthenticatedRef.current();

            return;
          }

          // The success flash of the brief. `standard` rather than a figure:
          // rule B allows 120/180/260/340/700 ms and nothing between them.
          flashTimer.current = setTimeout(() => {
            flashTimer.current = null;
            onAuthenticatedRef.current();
          }, durationMs('standard'));

          return;
        }

        const { failure: classified, field } = classifyFailure(result.error);
        setPhase('idle');
        setFailure(classified);

        if (field !== undefined) {
          setProblems({
            [field]: field === 'email'
              ? AUTH_MESSAGES.problems.emailInvalid
              : fillTemplate(AUTH_MESSAGES.problems.passwordTooShort, {
                  count: String(MIN_PASSWORD_LENGTH),
                }),
          });
        }

        if (classified.kind === 'tooManyAttempts') {
          lock(LOCKOUT_SECONDS);
        }
      })
      .catch((thrown: unknown) => {
        inFlight.current = false;
        setPhase('idle');
        setFailure({ kind: 'transport', cause: thrown });
      });
  }, [gateway, isBlocked, isLockedOut, lock, reducedMotion]);

  /* ---- what the view sees -------------------------------------------------- */

  const notice = useMemo<AuthNotice | null>(() => {
    if (phase === 'succeeded') {
      // Green, and earned: invariant A5 reserves verified for something the
      // person themselves did, and signing in is exactly that.
      return { tone: 'verified', message: AUTH_MESSAGES.notices.success };
    }

    if (failure !== null) {
      return noticeFor(failure);
    }

    // Only at rest: the session THIS attempt opens turns `onReturnToApp` on before the reply
    // lands, and the strip would flash between "đang gửi" and "đã đăng nhập" (BUG-006).
    if (onReturnToApp !== undefined && phase === 'idle') {
      return {
        tone: 'attention',
        message: AUTH_MESSAGES.notices.signedIn,
        action: { label: AUTH_MESSAGES.actions.goToProjects, onClick: onReturnToApp },
      };
    }

    return openingNotice === undefined ? null : INITIAL_NOTICES[openingNotice];
  }, [failure, onReturnToApp, openingNotice, phase]);

  const isSubmitting = phase === 'submitting';

  /**
   * One of the seven, by a precedence that answers "what is the most important
   * true thing about this screen right now".
   *
   * `collapsed` first because a folded form shows none of the rest. `forbidden`
   * next because a disabled account does not care what is in the fields. Then
   * the attempt's own states, and only after all of those does the shape of
   * what has been typed get to decide.
   */
  const state = useMemo<SevenState>(() => {
    if (isCollapsed) {
      return 'collapsed';
    }
    if (panel === 'forgotPassword') {
      return forgotStateOf(forgot);
    }
    if (isBlocked) {
      return 'forbidden';
    }
    if (isSubmitting) {
      return 'loading';
    }
    if (phase === 'succeeded') {
      return 'success';
    }
    if (failure !== null) {
      return 'error';
    }
    // "Đã có thư điện tử" only when the address is one: a malformed one already has its own complaint.
    if (firstProblem('email', values.email) === undefined && values.password.length === 0) {
      return 'partial';
    }

    return 'empty';
  }, [failure, forgot, isBlocked, isCollapsed, isSubmitting, panel, phase, values.email, values.password]);

  const model: AuthScreenModel = {
    state,
    panel,
    forgot,
    isCollapsed,
    isSubmitting,
    values,
    problems,
    notice,
    canSubmit: !isSubmitting && !isBlocked && !isLockedOut,
    submitLabel: AUTH_MESSAGES.actions.signIn,
    isBlocked,
  };

  const actions: AuthScreenActions = {
    setEmail,
    setPassword,
    setRememberMe,
    blurField,
    setCollapsed,
    submit,
    ...(onSsoSignIn !== undefined ? { ssoSignIn: onSsoSignIn } : {}),
    forgotPassword,
    closeForgotPassword,
    signInWithAnotherAccount,
    forgotActions,
  };

  return { model, actions };
}
