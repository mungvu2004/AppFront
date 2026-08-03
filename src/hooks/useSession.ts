import { useSyncExternalStore } from 'react';

import { getSession, subscribeToSession } from '@/lib/auth/session';

export const useSession = () => useSyncExternalStore(subscribeToSession, getSession, getSession);
