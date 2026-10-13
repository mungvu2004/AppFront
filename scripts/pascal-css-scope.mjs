/**
 * Khoanh CSS của Pascal (Tailwind v4) vào trong phần tử `.pascal-root`.
 *
 * Pascal và AppFront sống chung một trang nhưng là hai Tailwind khác đời (v4 và
 * 3.4). Plugin này chạy SAU `@tailwindcss/postcss` trong `vite.pascal.config.ts`
 * và chặn rò theo cả hai chiều:
 *
 *   - **Pascal không rò ra AppFront**: mọi selector có tiền tố `.pascal-root`;
 *     `:root`/`:host`/`html`/`body` thành chính `.pascal-root` (biến theme,
 *     phông, nền); `@keyframes` đổi tên thành `pascal-*`; `@property` (đăng ký
 *     TOÀN CỤC, không khoanh được) đổi thành khối đặt giá trị đầu cho từng phần tử
 *     con — đúng cách Tailwind 3 làm.
 *   - **AppFront không phá Pascal**: CSS của AppFront không nằm trong `@layer`
 *     nào, mà CSS ngoài layer luôn thắng CSS trong layer bất kể độ đặc hiệu — nên
 *     preflight AppFront (`button { background-color: transparent }`) sẽ đè mọi
 *     lớp `bg-*` của Pascal. Plugin gỡ các `@layer` (giữ thứ tự theme → base →
 *     components → utilities → phần ngoài layer), và tiền tố `.pascal-root` cho
 *     mỗi luật Pascal thêm một lớp độ đặc hiệu, đủ thắng mọi luật một-lớp của
 *     AppFront.
 *
 * Vì sao không dùng Shadow DOM: sự kiện bàn phím bắt ở `window` thấy `target` là
 * phần tử chủ chứ không phải ô nhập (Pascal dựa vào nó để không bắt phím tắt lúc
 * gõ chữ), và `@property` không có hiệu lực trong shadow root.
 */

export const PASCAL_ROOT = '.pascal-root';

const ROOT_SELECTORS = new Set([':root', ':host', 'html', 'body']);
const LAYER_ORDER = ['theme', 'base', 'components', 'utilities'];

/** Một selector đơn (đã tách theo dấu phẩy) → các selector đã khoanh. */
function scopeSelector(selector) {
  const s = selector.trim();
  if (ROOT_SELECTORS.has(s)) return [PASCAL_ROOT];
  // `.dark` của Pascal gắn lên chính gốc (xem `editor/src/lib/pascal-root.ts`).
  if (s === '.dark') return [`${PASCAL_ROOT}.dark`, `${PASCAL_ROOT} .dark`];
  return [`${PASCAL_ROOT} ${s}`];
}

function insideKeyframes(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === 'atrule' && /keyframes$/i.test(p.name)) return true;
  }
  return false;
}

/** @returns {import('postcss').Plugin} */
export function pascalCssScope() {
  return {
    postcssPlugin: 'pascal-css-scope',
    OnceExit(root, { rule: makeRule, decl: makeDecl }) {
      // 1. `@property` → giá trị đầu cho từng phần tử con của gốc.
      const initials = makeRule({
        selectors: [`${PASCAL_ROOT} *`, `${PASCAL_ROOT} ::before`, `${PASCAL_ROOT} ::after`, `${PASCAL_ROOT} ::backdrop`],
      });
      root.walkAtRules('property', (at) => {
        let value = 'initial';
        at.walkDecls('initial-value', (d) => {
          value = d.value;
        });
        initials.append(makeDecl({ prop: at.params.trim(), value }));
        at.remove();
      });
      // Khối dự phòng của Tailwind cho trình duyệt thiếu `@property` — khối trên đã thay nó.
      root.walkAtRules('layer', (at) => {
        if (at.params.trim() === 'properties' && at.nodes) at.remove();
      });

      // 2. Đổi tên keyframes để không đè `spin`/`pulse`… của AppFront.
      const names = new Set();
      root.walkAtRules(/keyframes$/i, (at) => {
        names.add(at.params.trim());
        at.params = `pascal-${at.params.trim()}`;
      });
      if (names.size > 0) {
        const escaped = [...names].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const re = new RegExp(`(?<![\\w-])(${escaped.join('|')})(?![\\w-])`, 'g');
        root.walkDecls((d) => {
          if (/^(animation|animation-name)$/i.test(d.prop) || d.prop.startsWith('--')) {
            if (d.prop.startsWith('--') && !/animat/i.test(d.prop)) return;
            d.value = d.value.replace(re, 'pascal-$1');
          }
        });
      }

      // 3. Tiền tố selector.
      root.walkRules((rule) => {
        // Luật lồng (`&:hover`) đã thừa hưởng tiền tố từ luật cha.
        if (insideKeyframes(rule) || rule.parent?.type === 'rule') return;
        rule.selectors = [...new Set(rule.selectors.flatMap(scopeSelector))];
      });

      // 4. Gỡ `@layer`: gom nội dung theo tên layer, xếp lại theo thứ tự cascade cũ.
      const buckets = new Map();
      const unlayered = [];
      for (const node of [...root.nodes]) {
        node.remove();
        if (node.type === 'atrule' && node.name === 'layer') {
          if (!node.nodes) continue; // câu khai thứ tự `@layer a, b;`
          const name = node.params.trim();
          if (!buckets.has(name)) buckets.set(name, []);
          buckets.get(name).push(...node.nodes);
        } else {
          unlayered.push(node);
        }
      }
      const order = [...LAYER_ORDER, ...[...buckets.keys()].filter((n) => !LAYER_ORDER.includes(n))];
      const ordered = order.flatMap((name) => buckets.get(name) ?? []);
      // `@layer` lồng (trong `@media`…) chỉ gỡ vỏ tại chỗ.
      root.append(initials.nodes.length > 0 ? [initials] : [], ...ordered, ...unlayered);
      root.walkAtRules('layer', (at) => {
        if (at.nodes) at.replaceWith(at.nodes);
        else at.remove();
      });
    },
  };
}
pascalCssScope.postcss = true;
