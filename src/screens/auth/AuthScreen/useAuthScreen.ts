/**
 * Everything the sign-in screen knows, with nothing it can draw.
 *
 * The logic half of invariant D's split. It owns the two field values, which of
 * the two tabs is open, what the last attempt did, and which of invariant A11's
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
 *   cleared on failure and not cleared when the tab changes. Retyping an address
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
  FullNameSchema,
  MIN_PASSWORD_LENGTH,
  PasswordSchema,
  RegisterSchema,
  SignInSchema,
  type RegisterInput,
  type SignInInput,
} from '@/api/schemas';
import { describeError, toAppError } from '@/lib/errors';
import type { Result } from '@/lib/http';
import { durationMs } from '@/lib/motion';
import type { SevenState } from '@/lib/testing/sevenStateScenarios';

import viMessages from '@/i18n/vi.json';

export { MIN_PASSWORD_LENGTH, RegisterSchema, SignInSchema };
export type { RegisterInput, SignInInput };

/* -------------------------------------------------------------------------- */
/* Wording.                                                                    */
/* -------------------------------------------------------------------------- */

const AUTH_MESSAGES = viMessages.auth;

/**
 * `{{name}}` filled from a table.
 *
 * `describeError` has the same three lines and does not export them. Copying
 * them is the smaller of the two wrongs: the alternative is widening the error
 * module's public surface for a screen, and `src/lib` is not a path this change
 * may edit.
 */
function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => values[key] ?? whole);
}

/* -------------------------------------------------------------------------- */
/* The port.                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The two calls this screen makes, and the only way it reaches a network.
 *
 * Returning a `Result` rather than throwing keeps the failure path ordinary: a
 * rejected password is a value this hook classifies, not an exception it has to
 * catch in three places.
 */
export interface AuthGateway {
  readonly signIn: (input: SignInInput, signal?: AbortSignal) => Promise<Result<void, unknown>>;
  readonly register: (input: RegisterInput, signal?: AbortSignal) => Promise<Result<void, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Shapes the view reads.                                                      */
/* -------------------------------------------------------------------------- */

/** Which tab is open. */
export type AuthTab = 'signIn' | 'register';

/** The three fields, by the name the view labels them under. */
export type AuthField = 'email' | 'password' | 'fullName';

/** The state colours invariant A4 allows. Named here so the hook stays free of components. */
export type AuthNoticeTone = 'verified' | 'attention' | 'violation';

/** A sentence the form shows in its own strip — never a toast, never a modal (A9). */
export interface AuthNotice {
  readonly tone: AuthNoticeTone;
  /** Absent when the message says the whole thing on its own. */
  readonly title?: string;
  readonly message: string;
}

/** A complaint under one field, or nothing when the field is fine. */
export type AuthProblems = Partial<Readonly<Record<AuthField, string>>>;

/** Everything typed into the form. */
export interface AuthValues {
  readonly email: string;
  readonly password: string;
  readonly fullName: string;
  readonly rememberMe: boolean;
}

/** What the view renders from. Every field is decided; none needs interpreting. */
export interface AuthScreenModel {
  readonly state: SevenState;
  readonly tab: AuthTab;
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
  readonly setTab: (tab: AuthTab) => void;
  readonly setEmail: (email: string) => void;
  readonly setPassword: (password: string) => void;
  readonly setFullName: (fullName: string) => void;
  readonly setRememberMe: (rememberMe: boolean) => void;
  /** Validates one field, on the way out of it. */
  readonly blurField: (field: AuthField) => void;
  readonly setCollapsed: (isCollapsed: boolean) => void;
  readonly submit: () => void;
}

export interface UseAuthScreenOptions {
  readonly gateway: AuthGateway;
  /** Called after the success flash, to send the visitor back where they came from. */
  readonly onAuthenticated: () => void;
  readonly initialTab?: AuthTab;
  /** Skips the success flash, so a person who asked for less motion waits for nothing. */
  readonly reducedMotion?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Failures.                                                                   */
/* -------------------------------------------------------------------------- */

/** How long the server locks an address out for, when it does not say. */
export const LOCKOUT_SECONDS = 60;

/** One second, named so `local/no-raw-duration` sees a constant rather than a literal. */
const COUNTDOWN_TICK_MS = 1000;

const UNAUTHORIZED_STATUS = 401;
const FORBIDDEN_STATUS = 403;
const TOO_MANY_REQUESTS_STATUS = 429;

/** What the server said, reduced to the four cases this screen answers differently. */
type AuthFailure =
  | { readonly kind: 'invalidCredentials' }
  | { readonly kind: 'accountDisabled' }
  | { readonly kind: 'tooManyAttempts'; readonly seconds: number }
  | { readonly kind: 'transport'; readonly cause: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The HTTP status buried in whatever the gateway rejected with, if there is one. */
function statusOf(error: unknown): number | null {
  if (isRecord(error) && typeof error.status === 'number') {
    return error.status;
  }

  return null;
}

/** How many seconds the server asked us to wait, or the default lockout. */
function retryAfterSecondsOf(error: unknown): number {
  if (isRecord(error) && typeof error.retryAfterSeconds === 'number' && error.retryAfterSeconds > 0) {
    return error.retryAfterSeconds;
  }

  return LOCKOUT_SECONDS;
}

function classifyFailure(error: unknown): AuthFailure {
  switch (statusOf(error)) {
    case UNAUTHORIZED_STATUS:
      return { kind: 'invalidCredentials' };
    case FORBIDDEN_STATUS:
      return { kind: 'accountDisabled' };
    case TOO_MANY_REQUESTS_STATUS:
      return { kind: 'tooManyAttempts', seconds: retryAfterSecondsOf(error) };
    default:
      return { kind: 'transport', cause: error };
  }
}

/**
 * A failure as the strip will read it.
 *
 * The three auth-specific cases come from `auth.errors.*`, because "sai mật
 * khẩu" is wording this screen owns. Everything else — no network, a timeout, a
 * gateway that fell over — goes to `describeError`, which is the module that
 * owns the rest of the product's error wording, so a dropped connection reads
 * the same here as it does anywhere else.
 */
function noticeFor(failure: AuthFailure, secondsLeft: number): AuthNotice {
  switch (failure.kind) {
    case 'invalidCredentials':
      return {
        tone: 'violation',
        title: AUTH_MESSAGES.errors.invalidCredentials.title,
        message: AUTH_MESSAGES.errors.invalidCredentials.description,
      };
    case 'accountDisabled':
      return {
        tone: 'attention',
        title: AUTH_MESSAGES.errors.accountDisabled.title,
        message: AUTH_MESSAGES.errors.accountDisabled.description,
      };
    case 'tooManyAttempts':
      return {
        tone: 'attention',
        title: AUTH_MESSAGES.errors.tooManyAttempts.title,
        message: fillTemplate(AUTH_MESSAGES.errors.tooManyAttempts.description, {
          seconds: String(secondsLeft),
        }),
      };
    default: {
      const described = describeError(toAppError(failure.cause));

      return { tone: 'violation', title: described.title, message: described.description };
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Validation.                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * What each field says when it is simply not filled in.
 *
 * Three of the four complaints this screen can make are this one, said about a
 * different box.
 */
const MISSING_BY_FIELD: Readonly<Record<AuthField, string>> = {
  email: AUTH_MESSAGES.problems.emailRequired,
  password: AUTH_MESSAGES.problems.passwordRequired,
  fullName: AUTH_MESSAGES.problems.fullNameRequired,
};

/**
 * A failed check, as a sentence.
 *
 * The schemas in `src/api/schemas` carry no messages — they describe a shape,
 * and a shape has no language. This is where a shape that did not hold becomes
 * something a person can act on, and the two cases worth telling apart from
 * "chưa nhập" are the only two the schemas can produce:
 *
 * - `invalid_string`, which only `EmailSchema` can raise, and only for the
 *   address format.
 * - `too_small` at exactly {@link MIN_PASSWORD_LENGTH}, which is the password
 *   being short rather than absent. An empty box raises `too_small` too, at a
 *   minimum of one, and falls through to the missing sentence — which is why
 *   the `.min(1)` in `PasswordSchema` is declared before the `.min(8)`.
 */
function sentenceFor(field: AuthField, issue: z.ZodIssue): string {
  if (issue.code === 'invalid_string') {
    return AUTH_MESSAGES.problems.emailInvalid;
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

/** Which fields the open tab asks for. */
function fieldsOf(tab: AuthTab): readonly AuthField[] {
  return tab === 'register' ? ['fullName', 'email', 'password'] : ['email', 'password'];
}

const SCHEMA_BY_FIELD: Readonly<Record<AuthField, z.ZodType<unknown>>> = {
  email: EmailSchema,
  password: PasswordSchema,
  fullName: FullNameSchema,
};

function valueOf(values: AuthValues, field: AuthField): string {
  switch (field) {
    case 'email':
      return values.email;
    case 'password':
      return values.password;
    default:
      return values.fullName;
  }
}

/* -------------------------------------------------------------------------- */
/* The hook.                                                                   */
/* -------------------------------------------------------------------------- */

/** What the last attempt left behind. */
type Phase = 'idle' | 'submitting' | 'succeeded';

const EMPTY_VALUES: AuthValues = { email: '', password: '', fullName: '', rememberMe: false };

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
  const { gateway, onAuthenticated, initialTab = 'signIn', reducedMotion = false } = options;

  const [tab, setTabState] = useState<AuthTab>(initialTab);
  const [values, setValues] = useState<AuthValues>(EMPTY_VALUES);
  const [problems, setProblems] = useState<AuthProblems>({});
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [isCollapsed, setCollapsedState] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

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

  useEffect(() => {
    if (secondsLeft <= 0) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsLeft((remaining) => (remaining > 0 ? remaining - 1 : 0));
    }, COUNTDOWN_TICK_MS);

    return () => {
      clearInterval(timer);
    };
  }, [secondsLeft]);

  /** The lockout is over the moment the count reaches zero; the strip goes with it. */
  useEffect(() => {
    if (secondsLeft === 0) {
      setFailure((current) => (current?.kind === 'tooManyAttempts' ? null : current));
    }
  }, [secondsLeft]);

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

  const setFullName = useCallback(
    (fullName: string) => {
      editField('fullName', { fullName });
    },
    [editField],
  );

  const setRememberMe = useCallback((rememberMe: boolean) => {
    setValues((current) => ({ ...current, rememberMe }));
  }, []);

  const blurField = useCallback((field: AuthField) => {
    const problem = firstProblem(field, valueOf(valuesRef.current, field));

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

  /**
   * Changing tab keeps the address and drops the verdicts.
   *
   * Keeping what was typed is invariant-adjacent — the brief asks for it by
   * name — and dropping the complaints is the other half: a "chưa nhập họ và
   * tên" left over from the register tab is a lie on the sign-in tab.
   */
  const setTab = useCallback((next: AuthTab) => {
    setTabState(next);
    setProblems({});
    setFailure((current) => (current?.kind === 'accountDisabled' ? current : null));
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
  }, []);

  /* ---- submitting --------------------------------------------------------- */

  const isBlocked = failure?.kind === 'accountDisabled';
  const isLockedOut = secondsLeft > 0;

  const submit = useCallback(() => {
    if (inFlight.current || isBlocked || isLockedOut) {
      return;
    }

    const current = valuesRef.current;
    // Mutable while it is being filled; handed to `setProblems` as the readonly
    // shape the view sees.
    const found: Partial<Record<AuthField, string>> = {};

    for (const field of fieldsOf(tab)) {
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
    inFlight.current = true;
    setPhase('submitting');

    const send =
      tab === 'register'
        ? gateway.register({
            email: current.email,
            password: current.password,
            rememberMe: current.rememberMe,
            fullName: current.fullName.trim(),
          })
        : gateway.signIn({
            email: current.email,
            password: current.password,
            rememberMe: current.rememberMe,
          });

    void send
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

        const classified = classifyFailure(result.error);
        setPhase('idle');
        setFailure(classified);

        if (classified.kind === 'tooManyAttempts') {
          setSecondsLeft(classified.seconds);
        }
      })
      .catch((thrown: unknown) => {
        inFlight.current = false;
        setPhase('idle');
        setFailure({ kind: 'transport', cause: thrown });
      });
  }, [gateway, isBlocked, isLockedOut, reducedMotion, tab]);

  /* ---- what the view sees -------------------------------------------------- */

  const notice = useMemo<AuthNotice | null>(() => {
    if (phase === 'succeeded') {
      // Green, and earned: invariant A5 reserves verified for something the
      // person themselves did, and signing in is exactly that.
      return { tone: 'verified', message: AUTH_MESSAGES.notices.success };
    }

    return failure === null ? null : noticeFor(failure, secondsLeft);
  }, [failure, phase, secondsLeft]);

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
    if (values.email.length > 0 && values.password.length === 0) {
      return 'partial';
    }

    return 'empty';
  }, [failure, isBlocked, isCollapsed, isSubmitting, phase, values.email, values.password]);

  const model: AuthScreenModel = {
    state,
    tab,
    isCollapsed,
    isSubmitting,
    values,
    problems,
    notice,
    canSubmit: !isSubmitting && !isBlocked && !isLockedOut,
    submitLabel: tab === 'register' ? AUTH_MESSAGES.actions.register : AUTH_MESSAGES.actions.signIn,
    isBlocked,
  };

  const actions: AuthScreenActions = {
    setTab,
    setEmail,
    setPassword,
    setFullName,
    setRememberMe,
    blurField,
    setCollapsed,
    submit,
  };

  return { model, actions };
}
