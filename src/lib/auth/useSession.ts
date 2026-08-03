import { useSyncExternalStore } from 'react';
import { getSession, subscribeToSession } from './session';

export const useSession = () => useSyncExternalStore(subscribeToSession, getSession, getSession);
