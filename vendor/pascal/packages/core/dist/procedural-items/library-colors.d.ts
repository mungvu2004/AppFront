import { type MaterialCatalogItem } from '../material-library.js';
import type { ProceduralItemNode } from './node.js';
import type { Recipe } from './recipe.js';
type ProceduralFinish = NonNullable<Recipe['slots'][number]['finish']>;
export declare const FINISH_LIBRARY_REFS: {
    readonly glass: readonly [{
        readonly ref: "library:preset-glass";
        readonly color: "#87ceeb";
    }];
    readonly metal: readonly [{
        readonly ref: "library:metal-steel";
        readonly color: "#636363";
    }, {
        readonly ref: "library:metal-chrome";
        readonly color: "#c8ccce";
    }, {
        readonly ref: "library:metal-brass";
        readonly color: "#b08d57";
    }, {
        readonly ref: "library:metal-copper";
        readonly color: "#cc845b";
    }, {
        readonly ref: "library:metal-polished";
        readonly color: "#f3f3f3";
    }, {
        readonly ref: "library:preset-metal";
        readonly color: "#c7ccd2";
    }];
    readonly wood: readonly [{
        readonly ref: "library:wood-finewood27";
        readonly color: "#a77440";
    }, {
        readonly ref: "library:wood-woodplank48";
        readonly color: "#88654c";
    }, {
        readonly ref: "library:wood-hungarianparquet2";
        readonly color: "#663020";
    }, {
        readonly ref: "library:wood-squareparquet21";
        readonly color: "#3e220d";
    }];
};
export declare function proceduralFinishLibraryColor(ref: string): string | undefined;
export declare function resolveProceduralFinishRef(finish: ProceduralFinish, color: string): `library:${string}` | undefined;
export type LibraryColorMatch = {
    ref: `library:${string}`;
    color: string;
    name: string;
    distance: number;
};
export declare function nearestLibraryColorRef(hex: string, catalog?: readonly MaterialCatalogItem[]): LibraryColorMatch | null;
export declare function snapProceduralSlotsToLibrary(node: ProceduralItemNode, options?: {
    keepOverrides: true;
}): ProceduralItemNode['slots'];
export {};
//# sourceMappingURL=library-colors.d.ts.map