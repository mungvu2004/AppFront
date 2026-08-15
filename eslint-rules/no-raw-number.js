/**
 * Numbers are formatted before they reach a view, never inside one.
 *
 * The companion of `no-raw-color`: that rule keeps colour decisions out of
 * `src/components` and `src/screens`, this one keeps number decisions out. A
 * component receives a `ViewModel` from `src/lib/viewmodel` whose every reading
 * is already a Vietnamese string, so there is nothing left for it to round,
 * localise or convert.
 *
 * Three things are refused, and only inside the two view folders:
 *
 * - `toFixed`, which writes a full stop where Vietnamese writes a comma
 *   (invariant A15) and rounds a surveyed dimension on its way to the screen.
 * - `toLocaleString`, which reaches for a locale the component happens to guess
 *   rather than the one `src/lib/format` pins for the whole application.
 * - Unit division — `valueMm / MILLIMETRES_PER_METRE`, `thicknessMm / 1000` —
 *   which is a conversion, and conversions belong to the domain.
 *
 * The division check is deliberately narrow. It fires on a divisor named like a
 * unit constant, or on a power-of-ten divisor whose dividend is named like a
 * measurement. Plain view arithmetic — a progress fraction, milliseconds turned
 * into the seconds a motion library wants — is left alone, because widening the
 * rule to catch those would only teach people to disable it.
 */

/** Methods that format a number, and therefore belong to `src/lib/format`. */
const FORBIDDEN_METHODS = new Set(['toFixed', 'toLocaleString']);

/**
 * A divisor named like a unit constant: `MILLIMETRES_PER_METRE`,
 * `SQUARE_MILLIMETRES_PER_SQUARE_METRE`. Dividing by one of these is a unit
 * conversion whatever the dividend is called.
 */
const UNIT_CONSTANT = /_PER_/;

/** Divisors that turn one metric unit into another. */
const UNIT_FACTORS = new Set([10, 100, 1000, 10000, 100000, 1000000]);

/**
 * A dividend named like a measurement.
 *
 * Matched case-insensitively against the end of the name, so `thicknessMm` and
 * `wall.centrelineLengthMm` are caught while `motionDuration260Ms` — milliseconds,
 * not millimetres — is not.
 */
const MEASUREMENT_SUFFIX =
  /(?:mm2?|m2|deg|rad|area|length|width|height|depth|thickness|elevation|offset|perimeter|distance|radius|diameter|sill|span)$/i;

const METHOD_MESSAGE =
  'Cấm gọi %s() trong src/components và src/screens; nhận chuỗi đã định dạng từ src/lib/viewmodel.';

const DIVISION_MESSAGE =
  'Cấm quy đổi đơn vị bằng phép chia trong src/components và src/screens; quy đổi thuộc về src/domain, định dạng thuộc về src/lib/viewmodel.';

/** The name a node is known by, looking through the TypeScript wrappers. */
function nameOf(node) {
  if (node === null || node === undefined) {
    return null;
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }

  if (
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSSatisfiesExpression'
  ) {
    return nameOf(node.expression);
  }

  return null;
}

/** Is `left / right` a unit conversion rather than ordinary arithmetic? */
function isUnitDivision(left, right) {
  const divisorName = nameOf(right);

  if (divisorName !== null && UNIT_CONSTANT.test(divisorName)) {
    return true;
  }

  if (right.type === 'Literal' && typeof right.value === 'number' && UNIT_FACTORS.has(right.value)) {
    const dividendName = nameOf(left);

    return dividendName !== null && MEASUREMENT_SUFFIX.test(dividendName);
  }

  return false;
}

/** The method a call goes through, whether written `x.toFixed()` or `x['toFixed']()`. */
function calledMethodName(callee) {
  if (callee.type !== 'MemberExpression') {
    return null;
  }

  if (!callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }

  if (callee.computed && callee.property.type === 'Literal' && typeof callee.property.value === 'string') {
    return callee.property.value;
  }

  return null;
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow number formatting (toFixed, toLocaleString) and unit division in components and screens',
    },
    schema: [],
  },
  create(context) {
    const filename = context.getPhysicalFilename ? context.getPhysicalFilename() : context.getFilename();
    const normalizedFilename = String(filename).replace(/\\/g, '/');

    if (!normalizedFilename.includes('src/components') && !normalizedFilename.includes('src/screens')) {
      return {};
    }

    const reportDivision = (node) => {
      context.report({ node, message: DIVISION_MESSAGE });
    };

    return {
      CallExpression(node) {
        const method = calledMethodName(node.callee);

        if (method !== null && FORBIDDEN_METHODS.has(method)) {
          context.report({ node, message: METHOD_MESSAGE.replace('%s', method) });
        }
      },
      BinaryExpression(node) {
        if (node.operator === '/' && isUnitDivision(node.left, node.right)) {
          reportDivision(node);
        }
      },
      AssignmentExpression(node) {
        if (node.operator === '/=' && isUnitDivision(node.left, node.right)) {
          reportDivision(node);
        }
      },
    };
  },
};
