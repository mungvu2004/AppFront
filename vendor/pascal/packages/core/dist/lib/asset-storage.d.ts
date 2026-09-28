export declare const ASSET_PREFIX = "asset_data:";
/**
 * Save a file to IndexedDB and return a custom protocol URL
 */
export declare function saveAsset(file: File): Promise<string>;
/**
 * Load a file from IndexedDB and return an object URL
 * If the URL is not a custom protocol URL, return it as is
 */
export declare function loadAssetUrl(url: string): Promise<string | null>;
//# sourceMappingURL=asset-storage.d.ts.map