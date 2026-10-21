/**
 * Plugin chất lượng dựng hình: mỗi luật khớp đúng một lần trên tệp vendor thật, chỉ đổi
 * đúng chỗ đó, và chuỗi gốc mất thì lượt dựng phải hỏng.
 *
 * Chạy được bằng cả `node --test` (thẻ U06) lẫn vitest (thư mục này nằm trong bộ vitest,
 * `globals: true`): có `describe` toàn cục thì là vitest, không thì lấy của `node:test`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { pascalRender, RENDER_RULES, transformRender } from '../pascal-render.mjs';

const { describe, it } = globalThis.describe ? globalThis : await import('node:test');
const PACKAGES = path.resolve('vendor/pascal/packages');

describe('pascal-render', () => {
  for (const [file, pairs] of Object.entries(RENDER_RULES)) {
    it(`áp luật đúng một lần trên ${file}`, () => {
      const id = path.join(PACKAGES, file);
      const code = readFileSync(id, 'utf8');
      // Bản checkout Windows là CRLF; luật viết theo `\n` nên so trên bản đã chuẩn hoá.
      const crlf = (s) => (code.includes('\r\n') ? s.replaceAll('\n', '\r\n') : s);
      const out = transformRender(code, id);
      let back = out;
      for (const [from, to] of pairs.map((p) => p.map(crlf))) {
        assert.equal(out.split(to).length - 1, 1, `thiếu ${to}`);
        back = back.replace(to, from);
      }
      assert.equal(back, code, 'ngoài các chỗ thay, tệp phải giữ nguyên');
    });
  }

  it('ném lỗi kèm tên tệp khi chuỗi gốc không còn hoặc lặp', () => {
    const id = path.join(PACKAGES, 'viewer/src/components/viewer/scene-environment.tsx');
    assert.throws(() => transformRender('const X = 1', id), /scene-environment\.tsx/);
    const imp = "import * as THREE from 'three/webgpu'";
    assert.throws(() => transformRender(`${imp}\n${imp}`, id), /2 lần/);
  });

  it('hỏng khi neo của dáng render (bloom, RoomEnvironment, bóng) không còn', () => {
    const at = (f) => path.join(PACKAGES, 'viewer/src/components/viewer', f);
    const drop = (f, anchor) => readFileSync(at(f), 'utf8').replace(anchor, '// gone');
    assert.throws(() => transformRender(drop('post-processing.tsx', 'const withOverlay = mix('), at('post-processing.tsx')), /withOverlay.*0 lần/);
    assert.throws(() => transformRender(drop('post-processing.tsx', '  contrast: 1.05,'), at('post-processing.tsx')), /contrast.*0 lần/);
    assert.throws(() => transformRender(drop('scene-environment.tsx', 'export function SceneEnvironment() {'), at('scene-environment.tsx')), /SceneEnvironment.*0 lần/);
    assert.throws(() => transformRender(drop('lights.tsx', 'const MAX_SHADOW_INTENSITY = 0.75'), at('lights.tsx')), /MAX_SHADOW_INTENSITY.*0 lần/);
  });

  it('dáng render: bloom + vignette chỉ ở rendered, RoomEnvironment chỉ chủ đề tối có WebGPU', () => {
    const at = (f) => path.join(PACKAGES, 'viewer/src/components/viewer', f);
    const post = transformRender(readFileSync(at('post-processing.tsx'), 'utf8'), at('post-processing.tsx'));
    assert.match(post, /import \{ bloom \} from 'three\/addons\/tsl\/display\/BloomNode\.js'/);
    assert.match(post, /if \(shading === 'rendered' && !transparentBackground\) \{\s+const lampGlow = bloom\(/);
    assert.match(post, /const withOverlay = mix\(looked, overlayColor\.rgb, overlayColor\.a\)/);
    const env = transformRender(readFileSync(at('scene-environment.tsx'), 'utf8'), at('scene-environment.tsx'));
    assert.match(env, /\(appearance === 'dark' && buildRoomEnvironment\(gl\)\) \|\| buildGradientSky\(\)/);
    assert.match(env, /!\('gpu' in navigator\)\) return null/);
    assert.match(env, /const ENV_INTENSITY_DARK = 0\.3/);
    assert.match(env, /const ENV_INTENSITY = 0\.8\s/);
  });

  it('giữ CRLF', () => {
    const id = path.join(PACKAGES, 'editor/src/components/editor/index.tsx');
    const code = '      selectionManager="default"\r\n    >\r\n      <ExportManager />\r\n';
    assert.equal(transformRender(code, id), '      selectionManager="default"\r\n    >\r\n      <SceneEnvironment />\r\n      <ExportManager />\r\n');
  });

  it('bỏ qua tệp ngoài bảng và báo tệp trong bảng không được dựng tới', () => {
    const plugin = pascalRender();
    assert.equal(plugin.transform('x', path.join(PACKAGES, 'a/b.tsx')), null);
    assert.throws(() => plugin.buildEnd(), /site-boundary\.ts/);
    for (const file of Object.keys(RENDER_RULES)) {
      const id = path.join(PACKAGES, file);
      plugin.transform(readFileSync(id, 'utf8'), `${id}?v=1`);
    }
    assert.doesNotThrow(() => plugin.buildEnd());
  });
});
