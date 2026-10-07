import type { DownspoutRouting } from './routing';
import type { DownspoutNode } from './schema';
/**
 * Translucent ghost of a downspout — same geometry as the committed
 * pipe so the placement ghost matches what lands on click. No
 * internal transform wrapper; the placement tool nests this under
 * the gutter / outlet chain so the position math stays in one place.
 *
 * `routing` mirrors the renderer's — when the tool resolves the host
 * gutter it feeds the same wall-jog so the ghost already shows the
 * elbowed path, not a straight drop.
 */
declare const DownspoutPreview: ({ node, routing, invalid, }: {
    node: DownspoutNode;
    routing?: DownspoutRouting | null;
    invalid?: boolean;
}) => import("react").JSX.Element;
export default DownspoutPreview;
//# sourceMappingURL=preview.d.ts.map