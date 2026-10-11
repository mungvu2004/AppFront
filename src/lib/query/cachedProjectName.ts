import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from './queryKeys';

interface Named {
  readonly id?: string;
  readonly name?: unknown;
}

const nameOf = (entry: Named | undefined): string | null =>
  typeof entry?.name === 'string' && entry.name.trim() !== '' ? entry.name : null;

/**
 * A project's name from what the cache already holds — #24's detail (`project.detail`) or the
 * dashboard's N1 cards (`project.summaries`) — so a screen that only has the id in its URL can
 * name the project in its breadcrumb without one more request (BUG-165).
 *
 * ponytail: a deep link with neither read cached gets `null` and the breadcrumb skips the level;
 * read #24 there if that ever matters.
 */
export function cachedProjectName(queryClient: QueryClient, projectId: string): string | null {
  const detail = nameOf(queryClient.getQueryData<Named>(queryKeys.project.detail(projectId)));
  if (detail !== null) return detail;

  const cards = queryClient.getQueryData<{ readonly projects?: readonly Named[] }>(queryKeys.project.summaries());
  return nameOf(cards?.projects?.find((card) => card.id === projectId));
}
