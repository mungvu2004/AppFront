/**
 * The `/login` screen, as three things a caller might want.
 *
 * - {@link AuthRoute} is what the router mounts: it builds the transport and
 *   works out where to go back to.
 * - {@link AuthScreen} is the screen with its logic attached, for a host that
 *   already has a gateway.
 * - {@link AuthScreenView} is the markup alone, for stories and tests.
 */

export { AuthRoute, AUTH_GATEWAY_UNAVAILABLE, createHttpAuthGateway, safeDestination } from './AuthScreen.container';
export { AuthScreen, AuthScreenView } from './AuthScreen';
export type { AuthScreenProps, AuthScreenViewProps } from './AuthScreen';
export {
  LOCKOUT_SECONDS,
  MIN_PASSWORD_LENGTH,
  RegisterSchema,
  SignInSchema,
  useAuthScreen,
} from './useAuthScreen';
export type {
  AuthField,
  AuthGateway,
  AuthNotice,
  AuthNoticeTone,
  AuthProblems,
  AuthScreenActions,
  AuthScreenModel,
  AuthTab,
  AuthValues,
  RegisterInput,
  SignInInput,
  UseAuthScreenOptions,
} from './useAuthScreen';
