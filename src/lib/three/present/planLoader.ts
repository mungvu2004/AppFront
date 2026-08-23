/**
 * A plan, fetched as content rather than shipped as code.
 *
 * A drawing is data the way a `.glb` is: it belongs to a screen, not to the
 * engine, and it is the one thing about a presentation that is allowed to be
 * large. Bundling it would put every wall and chair of a sign-in page's
 * scenery into a JavaScript chunk the size gate has to pay for; fetching it
 * puts it beside the models, late and cacheable. The download goes through
 * the same transport `assets.ts` uses for models, so the `no-fetch-outside-http`
 * rule is kept by construction, and a test injects a `download` that never
 * opens a socket.
 */

import { platformDownloader, type ModelDownloader } from './assets';
import { isPresentationPlan, type PresentationPlan } from './plan';

export interface PlanLoaderOptions {
  /** Fetches the bytes. The platform transport by default. */
  readonly download?: ModelDownloader;
  /** Aborts the download — wire it to the mount's dispose. */
  readonly signal?: AbortSignal;
}

/**
 * The plan at `url`, parsed and checked for shape.
 *
 * Rejects with whatever the transport raised, with a `SyntaxError` for a body
 * that is not JSON, and with a `TypeError` for JSON that is not a plan.
 */
export async function loadPlan(url: string, options: PlanLoaderOptions = {}): Promise<PresentationPlan> {
  const download = options.download ?? platformDownloader();
  const bytes = await download(url, options.signal ?? new AbortController().signal);
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));

  if (!isPresentationPlan(parsed)) {
    throw new TypeError(`Bản vẽ tại ${url} không có hình dạng của một bản vẽ.`);
  }

  return parsed;
}
