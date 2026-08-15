import { createRequire } from 'node:module';

import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';

/**
 * The rule is CommonJS, because ESLint loads its plugins that way; this file is
 * ESM, because vitest runs it. `createRequire` is the bridge, and it is the only
 * reason this file is not a plain import.
 */
const requireFromHere = createRequire(import.meta.url);
const rule = requireFromHere('../no-raw-number.js') as Parameters<RuleTester['run']>[1];

/** A file inside the gate: the rule watches `src/components` and `src/screens`. */
const COMPONENT_FILE = 'src/components/ui/SampleCard.tsx';
const SCREEN_FILE = 'src/screens/qc/SampleScreen.tsx';

/** A file outside the gate: formatting is exactly what these folders are for. */
const LIBRARY_FILE = 'src/lib/viewmodel/sample.ts';

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2020, sourceType: 'module' } });

describe('local/no-raw-number', () => {
  it('is registered under a name the config can reach', () => {
    const plugin = requireFromHere('../index.js') as { rules: Record<string, unknown> };

    if (plugin.rules['no-raw-number'] !== rule) {
      throw new Error('eslint-rules/index.js chưa export no-raw-number.');
    }
  });
});

ruleTester.run('no-raw-number', rule, {
  valid: [
    // A view reads finished strings off the view model and places them.
    { code: 'const text = attribute.value;', filename: COMPONENT_FILE },
    { code: 'const text = `${attribute.value} ${attribute.unit}`;', filename: COMPONENT_FILE },

    // Ordinary view arithmetic the rule deliberately leaves alone.
    { code: 'const seconds = motionDuration260Ms / 1000;', filename: COMPONENT_FILE },
    { code: 'const fraction = progress / 100;', filename: COMPONENT_FILE },
    { code: 'const centre = (first + second) / 2;', filename: COMPONENT_FILE },

    // Outside the two view folders, formatting is the point.
    { code: 'const text = value.toFixed(2);', filename: LIBRARY_FILE },
    { code: 'const metres = valueMm / MILLIMETRES_PER_METRE;', filename: LIBRARY_FILE },
  ],
  invalid: [
    {
      code: 'const text = confidence.toFixed(2);',
      filename: COMPONENT_FILE,
      errors: [{ message: /toFixed\(\)/u }],
    },
    {
      code: 'export const Row = () => wall.thicknessMm.toFixed(0);',
      filename: SCREEN_FILE,
      errors: 1,
    },
    {
      code: 'const text = item.thickness.toLocaleString("vi-VN");',
      filename: SCREEN_FILE,
      errors: [{ message: /toLocaleString\(\)/u }],
    },
    {
      code: 'const text = value["toFixed"](2);',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const metres = valueMm / MILLIMETRES_PER_METRE;',
      filename: COMPONENT_FILE,
      errors: [{ message: /quy đổi đơn vị/u }],
    },
    {
      code: 'const squareMetres = footprintMm2 / SQUARE_MILLIMETRES_PER_SQUARE_METRE;',
      filename: SCREEN_FILE,
      errors: 1,
    },
    {
      code: 'const metres = wall.thicknessMm / 1000;',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const centimetres = roomPerimeter / 10;',
      filename: SCREEN_FILE,
      errors: 1,
    },
    {
      code: 'let lengthMm = 3450; lengthMm /= 1000;',
      filename: COMPONENT_FILE,
      errors: 1,
    },
    {
      code: 'const both = value.toFixed(2) + other.toLocaleString();',
      filename: COMPONENT_FILE,
      errors: 2,
    },
  ],
});
