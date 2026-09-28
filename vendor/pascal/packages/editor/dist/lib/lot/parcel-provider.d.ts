export type ParcelEndpoint = 'autocomplete' | 'resolve' | 'roads' | 'elevation' | 'dossier';
/**
 * Answers one parcel call with the endpoint's JSON. `body` is the request:
 * `{ q }` for `autocomplete`, the posted JSON for the others.
 */
export type ParcelProvider = (endpoint: ParcelEndpoint, body: Record<string, unknown>) => Promise<unknown>;
export declare function setParcelProvider(next: ParcelProvider | null): void;
export declare function getParcelProvider(): ParcelProvider | null;
export declare function useParcelProvider(): ParcelProvider | null;
export declare const NO_PARCEL_SERVICE = "No parcel service is available.";
//# sourceMappingURL=parcel-provider.d.ts.map