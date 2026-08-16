/**
 * Motion durations are named, not typed out.
 *
 * The third of the `no-raw-*` family: `no-raw-color` keeps colour decisions out
 * of the two view folders, `no-raw-number` keeps number formatting out, and this
 * one keeps *timing* out. A view says how fast something moves by naming a slot
 * — `durationSeconds('fast')` — and `src/lib/motion` decides what that means.
 *
 * ## Why a rule and not a convention
 *
 * Rule B has always said only 120 / 180 / 260 / 340 / 700 ms are allowed, and
 * the enforcement was that only those five appear in `tailwind.config.ts`. That
 * was never enforcement. Two whole families walked straight past it:
 *
 * - `animate-pulse` came from Tailwind's own defaults at 2000 ms, and drew every
 *   loading state in the product for as long as the rule had existed.
 * - `animate-[pipeline-sweep_1.6s_infinite]` was an arbitrary value, so it never
 *   touched the config at all — and its keyframe was never declared either, so
 *   the animation it named had never once run.
 *
 * Neither was caught by reading the config, because neither was in the config.
 * A grep found them; a grep is not a gate.
 *
 * ## Three things are refused, and only inside the two view folders
 *
 * - A numeric `duration` in an object literal — `transition={{ duration: 0.18 }}`.
 *   Zero is allowed: it means *no animation*, which is a decision rather than a
 *   duration, and it is how an exit is made instant.
 * - A time inside a CSS string — `style={{ transition: 'opacity 180ms ease' }}`.
 *   Only properties that can actually carry a time are inspected, so a label
 *   that happens to read "Optimistic Async (800ms)" is left alone.
 * - A Tailwind arbitrary timing utility — `animate-[…]`, `duration-[…]`,
 *   `delay-[…]`. These bypass the theme entirely, which is the whole problem.
 *
 * ## Where it applies
 *
 * All of `src/`, unlike its two siblings, which watch only the view folders.
 * The invariant is "a duration is written down in exactly one place", and a hook
 * that builds a style object can breach that as easily as a component can.
 *
 * The one exemption is `src/lib/motion/**` — the place the durations are
 * *supposed* to be written. Exempting it by path rather than by disable-comment
 * keeps the source of truth obvious: the module the rule points everyone at is
 * the module the rule does not apply to.
 *
 * Two shapes stay legal everywhere, and deliberately:
 *
 * - A duration as a *parameter default* — `useNumberTween(value, ms = FOO)`.
 *   That is a caller-supplied duration, not a hardcoded one, and the default is
 *   read off the table anyway.
 * - `duration: 0`, which means *no animation*.
 *
 * `tailwind.config.ts` is not covered here; the rule-B guard in
 * `src/lib/motion/__tests__/motion.test.ts` reads every animation out of it and
 * checks each against the ladder, which is a check this rule could not make.
 *
 * If a `duration` really is a timeout rather than a movement — an eight second
 * undo window, say — disable the rule on that line and say so. The point is that
 * it becomes a sentence someone wrote on purpose.
 */

/** A CSS time: `180ms`, `1.6s`, `0.3s`. */
const TIME_LITERAL = /\d+(?:\.\d+)?\s*m?s\b/;

/** Tailwind arbitrary values that set a time, with any variant prefix. */
const ARBITRARY_TIMING = /\b(?:animate|duration|delay)-\[/;

/** Properties whose string value is CSS that can carry a time. */
const TIMED_CSS_PROPERTIES = new Set([
  'animation',
  'animationDelay',
  'animationDuration',
  'transition',
  'transitionDelay',
  'transitionDuration',
  'WebkitAnimation',
  'WebkitTransition',
]);

const NUMERIC_MESSAGE =
  'Cấm viết thẳng số thời lượng trong src/components và src/screens. Dùng durationSeconds() hoặc durationMs() từ src/lib/motion. Nếu đây là thời gian chờ chứ không phải chuyển động, hãy tắt rule kèm lý do.';

const CSS_TIME_MESSAGE =
  'Cấm viết thẳng thời lượng trong chuỗi CSS. Dùng cssDurationMs() từ src/lib/motion.';

const ARBITRARY_MESSAGE =
  'Cấm arbitrary value cho animate/duration/delay. Khai animation có tên trong tailwind.config.ts rồi dùng tên đó.';

/** The name a property is written under, ignoring computed keys. */
function propertyName(node) {
  if (node.computed) {
    return null;
  }

  if (node.key.type === 'Identifier') {
    return node.key.name;
  }

  if (node.key.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value;
  }

  return null;
}

/** Does this string — plain or templated — spell out a time? */
function spellsOutATime(node) {
  if (node.type === 'Literal') {
    return typeof node.value === 'string' && TIME_LITERAL.test(node.value);
  }

  if (node.type === 'TemplateLiteral') {
    // Only the static parts. An interpolated `${cssDurationMs('fast')}` is the
    // fix, not the offence.
    return node.quasis.some((quasi) => TIME_LITERAL.test(quasi.value.raw));
  }

  return false;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw animation durations (numeric, CSS strings, Tailwind arbitrary values) in components and screens',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getPhysicalFilename
      ? context.getPhysicalFilename()
      : context.getFilename();
    const normalizedFilename = String(filename).replace(/\\/g, '/');

    // Everywhere under src/, except the module that owns the durations.
    if (!normalizedFilename.includes('src/')) {
      return {};
    }

    if (normalizedFilename.includes('src/lib/motion/')) {
      return {};
    }

    const reportArbitrary = (node, text) => {
      if (typeof text === 'string' && ARBITRARY_TIMING.test(text)) {
        context.report({ node, message: ARBITRARY_MESSAGE });
      }
    };

    return {
      Property(node) {
        const name = propertyName(node);

        if (name === null) {
          return;
        }

        if (
          name === 'duration' &&
          node.value.type === 'Literal' &&
          typeof node.value.value === 'number' &&
          node.value.value !== 0
        ) {
          context.report({ node: node.value, message: NUMERIC_MESSAGE });
          return;
        }

        if (TIMED_CSS_PROPERTIES.has(name) && spellsOutATime(node.value)) {
          context.report({ node: node.value, message: CSS_TIME_MESSAGE });
        }
      },
      Literal(node) {
        reportArbitrary(node, node.value);
      },
      TemplateElement(node) {
        reportArbitrary(node, node.value.raw);
      },
    };
  },
};
