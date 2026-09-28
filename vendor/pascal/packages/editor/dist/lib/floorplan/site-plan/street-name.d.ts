/**
 * Street names compared the way the Postal Service reads an address (USPS
 * Publication 28): a name is its directional, its core and its street type,
 * each spelling brought to the standard abbreviation. "4121 NW 34th St" and
 * OSM's "Northwest 34th Street" are one street; "Northwest 34th Terrace" is
 * another — the type is part of the name, and so is the quadrant.
 */
export interface StreetName {
    /** The directional before the name ("nw"), '' when none. */
    pre: string;
    /** The name itself, lower case ("34th", "castro"). */
    name: string;
    /** The street type as its Pub. 28 abbreviation ("st", "ter"), '' when the name carries none. */
    type: string;
    /** The directional after the type ("n" in "1st St N"), '' when none. */
    post: string;
}
/**
 * A street line read into its parts: the house number dropped, the type and
 * the directionals standardised. A word is only read as a type or a
 * directional when a name is left beside it ("North St" is the street named
 * North).
 */
export declare function parseStreetName(s: string | null | undefined): StreetName;
/**
 * Do two street lines name the same street? The names must agree, and so
 * must the street types and the directionals wherever both lines give one:
 * "NW 34th St" is "Northwest 34th Street" (and "34th Street"), never
 * "Northwest 34th Terrace" or "SW 34th St". A line with no name matches
 * nothing.
 */
export declare function sameStreet(a: string | StreetName | null | undefined, b: string | StreetName | null | undefined): boolean;
//# sourceMappingURL=street-name.d.ts.map