/**
 * Plugin tự host Draco/Basis: tệp vendor thật sau khi thay không còn trỏ CDN, và luật
 * không khớp module nào thì lượt dựng phải hỏng.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { pascalSelfHost, WORKER_SELF_HOST_RULES } from '../pascal-self-host.mjs';

const PACKAGES = path.resolve('vendor/pascal/packages');
const requireFromNodes = createRequire(path.join(PACKAGES, 'nodes/package.json'));
const DREI_GLTF = path.join(path.dirname(requireFromNodes.resolve('@react-three/drei')), 'core/Gltf.js');

const FILES = [
  path.join(PACKAGES, 'nodes/src/item/renderer.tsx'),
  path.join(PACKAGES, 'viewer/src/lib/ktx2-loader.ts'),
  DREI_GLTF,
];

describe('pascal-self-host', () => {
  it('thay hết CDN trong tệp vendor thật, mọi luật đều khớp', () => {
    const plugin = pascalSelfHost();
    const out = FILES.map((f) => plugin.transform(readFileSync(f, 'utf8'), f)?.code ?? '').join('\n');
    expect(out).not.toMatch(/gstatic\.com|jsdelivr\.net/);
    expect(out).toContain("'/draco/'");
    expect(out).toContain("'/basis/'");
    expect(() => plugin.buildEnd()).not.toThrow();
  });

  it('worker manifold: đường dự phòng jsDelivr thành đường trên chính máy', () => {
    const plugin = pascalSelfHost({ rules: WORKER_SELF_HOST_RULES });
    const file = path.join(PACKAGES, 'editor/src/lib/print-shell-compiler-manifold-core.ts');
    const out = plugin.transform(readFileSync(file, 'utf8'), file)?.code ?? '';
    expect(out).not.toMatch(/jsdelivr\.net/);
    expect(out).toContain('`/manifold-3d@');
    expect(() => plugin.buildEnd()).not.toThrow();
  });

  it('bỏ qua module không chứa chuỗi', () => {
    expect(pascalSelfHost().transform('const a = 1', 'x.ts')).toBeNull();
  });

  it('ném lỗi nêu luật không khớp module nào', () => {
    const plugin = pascalSelfHost();
    expect(() => plugin.buildEnd()).toThrow(/gstatic\.com.*jsdelivr\.net/);
    expect(() => plugin.buildEnd(new Error('khác'))).not.toThrow();
  });
});
