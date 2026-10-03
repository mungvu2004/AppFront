export declare const ASSETS_CDN_URL: string;
/**
 * Resolves an asset URL to the appropriate format:
 * - If URL starts with http:// or https://, return as-is (external URL)
 * - If URL starts with asset://, resolve from IndexedDB storage
 * - If URL starts with /, prepend CDN URL (absolute path)
 * - Otherwise, prepend CDN URL (relative path)
 */
export declare function resolveAssetUrl(url: string | undefined | null): Promise<string | null>;
/**
 * Synchronous version for URLs that don't need IndexedDB resolution
 * Only use this if you're sure the URL is not an asset:// URL
 */
export declare function resolveCdnUrl(url: string | undefined | null): string | null;
//# sourceMappingURL=asset-url.d.ts.map