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
 * ## Four things are refused
 *
 * - A numeric `duration` in an object literal — `transition={{ duration: 0.18 }}`.
 *   Zero is allowed: it means *no animation*, which is a decision rather than a
 *   duration, and it is how an exit is made instant.
 * - A time inside a CSS string — `style={{ transition: 'opacity 180ms ease' }}`.
 *   Only properties that can actually carry a time are inspected, so a label
 *   that happens to read "Optimistic Async (800ms)" is left alone.
 * - A Tailwind arbitrary timing utility — `animate-[…]`, `duration-[…]`,
 *   `delay-[…]`. These bypass the theme entirely, which is the whole problem.
 * - A numeric delay on `setTimeout` / `setInterval` — `setTimeout(clear, 400)`.
 *   Added after two hooks were found holding a flash for 400 ms, a figure rule B
 *   does not allow. Both had been there since before this rule existed and
 *   neither was ever reported, because a timer delay is a **call argument**, and
 *   the three checks above all look at properties and strings. The path scope was
 *   never the gap; the shape scope was. Zero is allowed, for the same reason as
 *   above — `setTimeout(fn, 0)` yields to the event loop, it does not animate.
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
 * - A duration as a *parameter default* — `(value, ms = MOTION_DURATIONS_MS.standard)`.
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

/** Timer functions whose second argument is a duration wearing a disguise. */
const TIMER_CALLEES = new Set(['setTimeout', 'setInterval']);

/**
 * Files whose timers are scaffolding rather than product motion.
 *
 * A test that waits 50 ms for a microtask to settle is not choosing how fast the
 * interface moves, and making every such line carry a disable comment is how a
 * rule teaches people to reach for the disable comment. The other three checks
 * still apply here — none of them has ever fired on a test.
 */
const SCAFFOLDING_FILE = /(?:\.test\.|\.stories\.|__tests__\/|__mocks__\/)/;

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

const TIMER_MESSAGE =
  'Cấm viết thẳng số mili-giây cho setTimeout/setInterval. Nếu đây là chuyển động, dùng durationMs() từ src/lib/motion. Nếu đây là thời gian chờ chứ không phải chuyển động, hãy tắt rule kèm lý do.';

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

/**
 * The name a call is made under, seeing through the host object.
 *
 * `setTimeout(…)` and `window.setTimeout(…)` are the same function, and a rule
 * that caught only the bare form would be one rename away from useless.
 */
function calleeName(node) {
  if (node.callee.type === 'Identifier') {
    return node.callee.name;
  }

  if (
    node.callee.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property.type === 'Identifier'
  ) {
    return node.callee.property.name;
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

    const checksTimers = !SCAFFOLDING_FILE.test(normalizedFilename);

    return {
      CallExpression(node) {
        if (!checksTimers) {
          return;
        }

        const name = calleeName(node);
        if (name === null || !TIMER_CALLEES.has(name)) {
          return;
        }

        const delay = node.arguments[1];
        if (
          delay !== undefined &&
          delay.type === 'Literal' &&
          typeof delay.value === 'number' &&
          delay.value !== 0
        ) {
          context.report({ node: delay, message: TIMER_MESSAGE });
        }
      },
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
