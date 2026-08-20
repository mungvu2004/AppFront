/**
 * The share screen, as the two things a caller might want.
 *
 * - {@link ShareScreen} is the screen with its hook attached, which is what
 *   `ShareRoute` mounts.
 * - {@link ShareScreenView} is the markup alone, for the stories and the test
 *   that walk invariant A11's seven states without a gateway.
 *
 * `ShareForm` and `ShareList` are deliberately **not** re-exported. They exist
 * because invariant R-22 caps a file at 400 lines, not because the screen grew
 * a public surface — nothing outside this folder should be assembling a share
 * screen out of halves.
 */

export { ShareScreen, ShareScreenView } from './ShareScreen';
export type { ShareScreenProps, ShareScreenViewProps } from './ShareScreen';
