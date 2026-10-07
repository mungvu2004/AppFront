import { z } from 'zod';
/**
 * Scheme allowlist for asset-like URLs embedded in scene graphs.
 *
 * Phase 3 security audit: `scan.url`, `guide.url`, `material.texture.url`, and
 * `item.asset.src` were previously bare `z.string()`. That meant an
 * attacker-crafted scene loaded in the editor could beacon to arbitrary URLs
 * (e.g. `javascript:`, `file:///etc/passwd`, `http://169.254.169.254/...`).
 *
 * This validator rejects URLs that don't match the scheme allowlist below.
 */
declare const ALLOWED_SCHEMES: readonly ["asset:", "blob:", "https:", "data:image/"];
/**
 * Optional environment variable that narrows which `https:` origins are
 * accepted. Set to a comma-separated list (e.g. `https://cdn.pascal.app`).
 * When unset, any `https:` origin is permitted.
 */
export declare const ALLOWED_ORIGINS_ENV = "PASCAL_ALLOWED_ASSET_ORIGINS";
/**
 * Zod validator for asset-style URL fields. Accepts:
 * - `asset://…` internal handles
 * - `blob:…` in-memory references
 * - `data:image/…` inline images (not `data:text/html` or other types)
 * - `/…` app-relative paths
 * - `https://…` public URLs (optionally narrowed to an env allowlist)
 * - `http://localhost[:port]/…` or `http://127.0.0.1/…` for local dev
 *
 * Rejects every other scheme, including `javascript:`, `file:`, `ftp:`,
 * and `data:text/html`, as well as empty strings and non-URL garbage.
 */
export declare const AssetUrl: z.ZodString;
export type AssetUrl = z.infer<typeof AssetUrl>;
export { ALLOWED_SCHEMES };
//# sourceMappingURL=asset-url.d.ts.map