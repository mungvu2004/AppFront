import type { IconRef } from '@pascal-app/core';
/**
 * A `url`-kind icon. An SVG behind an `<img>` renders in its own document, so
 * `currentColor` in the markup resolves to black rather than the surrounding
 * text colour — a monochrome plugin glyph then disappears against the dark
 * sidebar. Such an SVG becomes a CSS mask over the text colour instead. Plugin
 * manifests are third-party, so the markup is never inlined into the page.
 */
export declare function IconRefImage({ className, size, src, }: {
    className?: string;
    size?: number;
    src: string;
}): import("react").JSX.Element;
/**
 * Generic renderer for a registry {@link IconRef} — url / iconify / inline-svg
 * marks are sized by `size` (px); `component`-kind icons size themselves.
 * Shared by the quick-action menus; the icon rail and inspector keep their
 * own copies with bespoke wrappers for now.
 */
export declare function IconRefGlyph({ icon, size }: {
    icon: IconRef;
    size?: number;
}): import("react").JSX.Element;
//# sourceMappingURL=icon-ref.d.ts.map