/**
 * Phép tính của cổng kích thước gói — khoá từng cách sai cụ thể.
 *
 * Cổng này đo "chi phí **thêm** khi người dùng bước vào một màn". Nó đo đúng cho
 * route, và trước lượt sửa này thì đo sai cho **chunk tải muộn lồng trong một
 * chunk tải muộn khác** — một hình dạng chưa tồn tại khi cổng được viết. Panel
 * của trình xem 3D bị cộng lại cả bao đóng của màn cha, gồm 139 KiB `three` mà
 * người dùng bắt buộc đã tải xong trước khi bấm được nút mở panel.
 *
 * Bộ test dùng manifest dựng tay và bảng gzip dựng tay: không cần `dist/`, không
 * đọc đĩa, nên nó khoá PHÉP TÍNH chứ không khoá một bản dựng cụ thể.
 *
 * Mỗi ca dưới đây tương ứng một cách làm sai đã được cân nhắc trong lúc thiết
 * kế. Ca nào mất đi thì cách sai ấy quay lại mà không ai biết.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  DEV_ONLY_MARKERS,
  baselineFor,
  closure,
  closureGzip,
  findDevOnlyLeaks,
  findEvalSites,
  presentWhenLoaded,
} from '../check-bundle-size.mjs';

/** Dựng một mục manifest. `imports` là nhập tĩnh, `dynamicImports` là tải muộn. */
function chunk(file, { imports = [], dynamicImports = [], isEntry = false } = {}) {
  return { file, imports, dynamicImports, isEntry };
}

/** Bảng gzip giả: mỗi file một số byte, để phép cộng ra số tròn dễ đọc. */
function sizes(map) {
  return new Map(Object.entries(map));
}

const KIB = 1024;

describe('presentWhenLoaded — tập chunk chắc chắn đã hiện diện', () => {
  it('gồm CẢ người nhập tĩnh lẫn người nhập động', () => {
    const manifest = {
      'a.ts': chunk('assets/a.js', { imports: ['shared.ts'] }),
      'b.ts': chunk('assets/b.js', { dynamicImports: ['shared.ts'] }),
      'shared.ts': chunk('assets/shared.js'),
    };

    expect(presentWhenLoaded('shared.ts', manifest).sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('rỗng khi không ai nhập — và phép giao trên tập rỗng cho đúng entry', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', { isEntry: true }),
      'orphan.ts': chunk('assets/orphan.js'),
    };
    const entryClosure = closure(['index.html'], manifest);

    expect(presentWhenLoaded('orphan.ts', manifest)).toEqual([]);
    expect([...baselineFor('orphan.ts', manifest, entryClosure)]).toEqual([...entryClosure]);
  });
});

describe('baselineFor — bốn cách sai đã cân nhắc và bị loại', () => {
  /*
   * (a) Cha và con CÙNG kéo một module nặng.
   *
   * Phần chỉ RIÊNG con kéo vào phải vẫn được tính. Không có ca này thì phép trừ
   * có thể nuốt mã của panel mà không ai thấy — đặc biệt nếu sau này có người
   * thử lại `manualChunks` và đồ thị chunk đổi hình.
   */
  it('(a) phần chỉ chunk con kéo vào vẫn được tính, dù cha cũng kéo module nặng', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', { isEntry: true }),
      'screen.ts': chunk('assets/screen.js', {
        imports: ['index.html', 'heavy.ts'],
        dynamicImports: ['panel.ts'],
      }),
      'panel.ts': chunk('assets/panel.js', { imports: ['heavy.ts', 'only-panel.ts'] }),
      'heavy.ts': chunk('assets/heavy.js'),
      'only-panel.ts': chunk('assets/only-panel.js'),
    };
    const gzip = sizes({
      'assets/entry.js': 10 * KIB,
      'assets/screen.js': 20 * KIB,
      'assets/panel.js': 5 * KIB,
      'assets/heavy.js': 139 * KIB,
      'assets/only-panel.js': 7 * KIB,
    });

    const entryClosure = closure(['index.html'], manifest);
    const baseline = baselineFor('panel.ts', manifest, entryClosure);
    const added = [...closure(['panel.ts'], manifest)].filter((key) => !baseline.has(key));

    // `heavy` bị trừ (màn cha đã kéo nó), `panel` + `only-panel` thì không.
    expect(closureGzip(added, manifest, gzip)).toBe(12 * KIB);
    expect(added).toContain('only-panel.ts');
    expect(added).not.toContain('heavy.ts');
  });

  /*
   * (b) Chunk tới được từ HAI đường.
   *
   * Chỉ phần CẢ HAI đường đều mang theo mới chắc chắn đã tải. Ca này phải ĐỎ nếu
   * ai đó đổi giao thành hợp. Trên bản dựng thật, `lib/export/screenshot.ts` rơi
   * đúng vào hình dạng này: giao cho 15,2 KiB, hợp cho 5,1.
   */
  it('(b) hai đường tới: chỉ trừ phần GIAO, không trừ phần riêng của một đường', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', { isEntry: true }),
      'left.ts': chunk('assets/left.js', {
        imports: ['index.html', 'common.ts', 'only-left.ts'],
        dynamicImports: ['shared-tool.ts'],
      }),
      'right.ts': chunk('assets/right.js', {
        imports: ['index.html', 'common.ts'],
        dynamicImports: ['shared-tool.ts'],
      }),
      'shared-tool.ts': chunk('assets/tool.js', { imports: ['common.ts', 'only-left.ts'] }),
      'common.ts': chunk('assets/common.js'),
      'only-left.ts': chunk('assets/only-left.js'),
    };
    const gzip = sizes({
      'assets/entry.js': 10 * KIB,
      'assets/left.js': 8 * KIB,
      'assets/right.js': 8 * KIB,
      'assets/tool.js': 4 * KIB,
      'assets/common.js': 30 * KIB,
      'assets/only-left.js': 25 * KIB,
    });

    const entryClosure = closure(['index.html'], manifest);
    const baseline = baselineFor('shared-tool.ts', manifest, entryClosure);
    const added = [...closure(['shared-tool.ts'], manifest)].filter((key) => !baseline.has(key));

    /*
     * `common` nằm trên cả hai đường ⇒ trừ. `only-left` chỉ nằm trên đường trái
     * ⇒ người tới từ đường phải CHƯA có nó ⇒ không được trừ. Dùng hợp sẽ trừ nốt
     * và con số tụt từ 29 xuống 4 KiB — đúng 25 KiB bị nuốt.
     */
    expect(added).toContain('only-left.ts');
    expect(added).not.toContain('common.ts');
    expect(closureGzip(added, manifest, gzip)).toBe(29 * KIB);
  });

  /*
   * (c) Bao đóng của K phải TĨNH.
   *
   * Sáu panel của trình xem 3D cùng được một chunk nhập động. Dùng bao đóng toàn
   * phần thì mỗi panel bị trừ luôn phần của các panel ANH EM — không panel nào
   * trong chúng đã tải khi một panel khác mở ra. Ca này phải ĐỎ nếu ai đó đổi
   * `followDynamic` thành `true`.
   */
  it('(c) bao đóng của K là TĨNH: không trừ phần của chunk anh em', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', { isEntry: true }),
      'shell.ts': chunk('assets/shell.js', {
        imports: ['index.html'],
        dynamicImports: ['panel-a.ts', 'panel-b.ts'],
      }),
      'panel-a.ts': chunk('assets/panel-a.js', { imports: ['lib-shared.ts'] }),
      'panel-b.ts': chunk('assets/panel-b.js', { imports: ['lib-shared.ts'] }),
      'lib-shared.ts': chunk('assets/lib-shared.js'),
    };
    const gzip = sizes({
      'assets/entry.js': 10 * KIB,
      'assets/shell.js': 12 * KIB,
      'assets/panel-a.js': 6 * KIB,
      'assets/panel-b.js': 40 * KIB,
      'assets/lib-shared.js': 9 * KIB,
    });

    const entryClosure = closure(['index.html'], manifest);
    const baseline = baselineFor('panel-a.ts', manifest, entryClosure);
    const added = [...closure(['panel-a.ts'], manifest)].filter((key) => !baseline.has(key));

    // `panel-b` là anh em, chưa hề tải — nó không được có mặt trong mốc trừ.
    expect(baseline.has('panel-b.ts')).toBe(false);
    expect(closureGzip(added, manifest, gzip)).toBe(15 * KIB);
  });

  /*
   * (d) Test âm — khẳng định trên GIÁ TRỊ của hàng, không qua ngưỡng.
   *
   * Cổng chỉ so ngưỡng với hàng TỆ NHẤT. Sau lượt sửa này panel nằm quanh 47 KiB
   * còn trần là 280, nên "thêm một lib nặng rồi xác nhận cổng đỏ" sẽ XANH và
   * chứng minh sai điều nó định chứng minh. Thứ cần khoá là: phép trừ không nuốt
   * mất phần tăng thêm.
   */
  it('(d) thêm N KiB vào một chunk lồng thì số của hàng ấy tăng đúng N', () => {
    const build = (extraKib) => {
      const manifest = {
        'index.html': chunk('assets/entry.js', { isEntry: true }),
        'shell.ts': chunk('assets/shell.js', {
          imports: ['index.html', 'heavy.ts'],
          dynamicImports: ['panel.ts'],
        }),
        'panel.ts': chunk('assets/panel.js', { imports: ['heavy.ts'] }),
        'heavy.ts': chunk('assets/heavy.js'),
      };
      const gzip = sizes({
        'assets/entry.js': 10 * KIB,
        'assets/shell.js': 12 * KIB,
        'assets/panel.js': (5 + extraKib) * KIB,
        'assets/heavy.js': 139 * KIB,
      });
      const entryClosure = closure(['index.html'], manifest);
      const baseline = baselineFor('panel.ts', manifest, entryClosure);
      const added = [...closure(['panel.ts'], manifest)].filter((key) => !baseline.has(key));

      return closureGzip(added, manifest, gzip);
    };

    expect(build(0)).toBe(5 * KIB);
    expect(build(150) - build(0)).toBe(150 * KIB);
  });

  /*
   * (e) T nhập TĨNH bởi K, nhập ĐỘNG bởi M.
   *
   * Bao đóng tĩnh của M KHÔNG chứa T, nên T không thuộc giao, nên T không bị
   * trừ. Đây là tính chất ngăn "chunk nhập tĩnh thì luôn về 0" lan sang trường
   * hợp không được phép. Nó rơi ra tự nhiên từ phép giao — chính vì thế mà một
   * lần refactor vô ý có thể đánh mất nó mà không ai nhận ra.
   */
  it('(e) nhập tĩnh ở một đường, nhập động ở đường kia ⇒ KHÔNG bị trừ', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', { isEntry: true }),
      'k.ts': chunk('assets/k.js', { imports: ['index.html', 'target.ts'] }),
      'm.ts': chunk('assets/m.js', { imports: ['index.html'], dynamicImports: ['target.ts'] }),
      'target.ts': chunk('assets/target.js'),
    };
    const gzip = sizes({
      'assets/entry.js': 10 * KIB,
      'assets/k.js': 8 * KIB,
      'assets/m.js': 8 * KIB,
      'assets/target.js': 60 * KIB,
    });

    const entryClosure = closure(['index.html'], manifest);
    const baseline = baselineFor('target.ts', manifest, entryClosure);
    const added = [...closure(['target.ts'], manifest)].filter((key) => !baseline.has(key));

    expect(baseline.has('target.ts')).toBe(false);
    expect(closureGzip(added, manifest, gzip)).toBe(60 * KIB);
  });

  /*
   * Mặt còn lại của (e): khi MỌI đường đều nhập tĩnh thì T nằm trong bao đóng
   * của tất cả, nên nó thuộc giao và hàng của nó về 0 — byte đã được tính ở
   * hàng của những người nhập. Trên bản dựng thật, `three.module.js` đúng hình
   * dạng này: 34 chunk nhập, và chunk nhập nó ở dạng động cũng nhập nó ở dạng
   * tĩnh. Về 0 là đúng, không phải mất dấu.
   */
  it('mọi đường đều nhập tĩnh ⇒ hàng về 0, vì byte đã tính ở nơi khác', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', { isEntry: true }),
      'k1.ts': chunk('assets/k1.js', { imports: ['index.html', 'target.ts'] }),
      'k2.ts': chunk('assets/k2.js', {
        imports: ['index.html', 'target.ts'],
        dynamicImports: ['target.ts'],
      }),
      'target.ts': chunk('assets/target.js'),
    };
    const gzip = sizes({
      'assets/entry.js': 10 * KIB,
      'assets/k1.js': 8 * KIB,
      'assets/k2.js': 8 * KIB,
      'assets/target.js': 139 * KIB,
    });

    const entryClosure = closure(['index.html'], manifest);
    const baseline = baselineFor('target.ts', manifest, entryClosure);
    const added = [...closure(['target.ts'], manifest)].filter((key) => !baseline.has(key));

    expect(closureGzip(added, manifest, gzip)).toBe(0);
  });
});

describe('route không đổi một byte', () => {
  /*
   * Tính chất quan trọng nhất của lượt sửa: hành vi CŨ được giữ nguyên cho route.
   *
   * `presentWhenLoaded` của một route là chính chunk vào, và bao đóng tĩnh của
   * chunk vào bằng đúng `entryClosure` — nên mốc trừ không đổi. Nếu ca này đỏ thì
   * lượt sửa đã đụng vào thứ nó hứa không đụng.
   */
  it('mốc trừ của một route bằng đúng entryClosure', () => {
    const manifest = {
      'index.html': chunk('assets/entry.js', {
        isEntry: true,
        imports: ['vendor.ts'],
        dynamicImports: ['route.ts'],
      }),
      'route.ts': chunk('assets/route.js', { imports: ['vendor.ts', 'route-only.ts'] }),
      'vendor.ts': chunk('assets/vendor.js'),
      'route-only.ts': chunk('assets/route-only.js'),
    };
    const gzip = sizes({
      'assets/entry.js': 10 * KIB,
      'assets/route.js': 20 * KIB,
      'assets/vendor.js': 100 * KIB,
      'assets/route-only.js': 30 * KIB,
    });

    const entryClosure = closure(['index.html'], manifest);
    const baseline = baselineFor('route.ts', manifest, entryClosure);

    expect([...baseline].sort()).toEqual([...entryClosure].sort());

    const added = [...closure(['route.ts'], manifest)].filter((key) => !baseline.has(key));
    expect(closureGzip(added, manifest, gzip)).toBe(50 * KIB);
  });
});

/*
 * Ca chặn hồi quy "bản dựng production không mang màn demo" (plan.md mục 6).
 * Cổng chạy trên `dist/` thật ở `pnpm size`; ở đây chỉ khoá hai điều cổng không
 * tự kiểm được: phép dò bắt đúng, và chuỗi đánh dấu vẫn còn trong nguồn.
 * Đường tệp tính từ gốc repo — cùng chỗ cổng đọc `dist/`.
 */
describe('màn demo chỉ bản dev', () => {
  it('bảng có đúng bảy màn của buildDevOnlyRoutes', () => {
    expect(DEV_ONLY_MARKERS).toHaveLength(7);
  });

  it.each(DEV_ONLY_MARKERS)('chuỗi đánh dấu của $source còn trong tệp nguồn', ({ source, marker }) => {
    const text = readFileSync(source, 'utf8');
    expect(text).toContain(marker);
  });

  it('bắt chuỗi đánh dấu trong tệp dựng, và chỉ ở tệp mang nó', () => {
    const files = [
      { name: 'index.js', text: 'createRoot(...)' },
      { name: 'leak.js', text: 'x="Canvas Overlays Demo",y=1' },
    ];

    expect(findDevOnlyLeaks(files)).toEqual([
      { source: 'src/screens/CanvasOverlaysDemo.tsx', marker: 'Canvas Overlays Demo', file: 'leak.js' },
    ]);
    expect(findDevOnlyLeaks(files.slice(0, 1))).toEqual([]);
  });
});

/*
 * Quét dựng-mã-từ-chuỗi (FIX-380). Mỗi ca là một bí danh từng trượt mẫu
 * `new Function` — thật, chép từ bản dựng chứ không bịa.
 */
describe('findEvalSites — CSP không có unsafe-eval', () => {
  const blockedOf = (text) => findEvalSites([{ name: 'x.js', text }]).blocked.length;

  it.each([
    ['embind', 'var invokerFn=newFunc(Function,args)(...closureArgs)'],
    ['bí danh rút gọn', 'var F=Function,g=new F("return 1")'],
    ['new Function', 'new Function("a","return a")'],
    ['gọi thẳng', 'x=Function("return this")()'],
    ['eval', 'eval("1+1")'],
    // Bí danh review lượt 1 (V-1) thử — mỗi dòng từng qua cổng xanh.
    ['eval gián tiếp', '(0,eval)(s)'],
    ['eval gián tiếp có cách', '(0, eval)(s)'],
    ['globalThis.Function', 'globalThis.Function("a")()'],
    ['window.Function', 'window.Function(s)'],
    ['self.eval', 'self.eval(s)'],
    ['return Function', 'return Function'],
    ['giá trị trong đối tượng', '{c:Function}'],
    ['nhánh ba ngôi', 'x?Function:y'],
    ['trong mảng', '[Function][0](s)'],
    ['Function.apply', 'Function.apply(null,[s])'],
    ['setTimeout nhận chuỗi', 'setTimeout("x()",1)'],
    ['Reflect.construct', 'Reflect.construct(Function,[s])'],
    // Review lượt 2 (N-1, N-2, nit 1).
    ['`//` trong chuỗi phía trước', 'var u="a //b";var F=Function;new F("x")'],
    ['`//` trong regex phía trước', 'var r=/ \\/\\//;var F=Function;new F("x")'],
    ['dòng minify dài sau một `//` trong chuỗi', `"a //b";${';'.repeat(200)}var F=Function`],
    ['globalThis?.Function', 'globalThis?.Function("x")()'],
    ['globalThis?.eval', 'globalThis?.eval("x")'],
    ['top.eval', 'top.eval(s)'],
    ['parent.Function', 'parent.Function(s)'],
    ['dòng bắt đầu bằng * ngoài chú thích', 'x = 2\n  * Function("y")'],
    // Review lượt 3 (R3-1 … R3-4).
    ['cặp /* */ giả trong header Accept', 'h={Accept:"*/*"};var F=Function;new F("x");k="*/*"'],
    ['cặp /* */ giả trong glob', 'g="src/**/*.js";var F=Function;q="a/**/b"'],
    ['bí danh biến của globalThis', 'var g=globalThis;g.Function("x")'],
    ['thuộc tính eval của đối tượng bất kỳ', 'obj.eval(y)'],
    ['Function.prototype.constructor', 'Function.prototype.constructor("x")()'],
    ['Function.prototype["constructor"]', 'Function.prototype["constructor"]("x")()'],
    ['.constructor gọi với chuỗi', '(function(){}).constructor("x")()'],
    ['.constructor.constructor', 'a.constructor.constructor(s)()'],
    ['hàm tạo AsyncFunction', 'Object.getPrototypeOf(async function(){}).constructor'],
    ['`//` trong lớp ký tự của regex', 'x=/[ //]/g,F=Function'],
  ])('bắt %s', (_label, text) => {
    expect(blockedOf(text)).toBeGreaterThan(0);
  });

  it.each([
    ['instanceof', 'if(f instanceof Function)return 1'],
    ['typeof', 'typeof f=="function"'],
    ['tên chứa chữ', 'isFunction(x);Function.prototype.call'],
    ['JSDoc một dòng', '/** @type {Function} */ var x'],
    ['gán hàm tạo vào prototype', 'X.prototype.constructor=X'],
    ['React tạo lại sự kiện', 'new(n=e.nativeEvent).constructor(n.type,n)'],
    ['JSDoc', ['  /**', '   * @param {Function} callback - x', '   */'].join('\n')],
    ['chú thích dòng', 'a=1; // Function-axis tag'],
    ['câu báo lỗi', 'throw new Error("THREE.FunctionNode: Function is not a GLSL code.")'],
    ['câu báo lỗi embind', "throwBindingError(`Function '${humanName}' called`)"],
  ])('bỏ qua %s', (_label, text) => {
    expect(blockedOf(text)).toBe(0);
  });

  it('miễn đúng hai chỗ zod theo nội dung, chỗ thứ ba trong cùng tệp vẫn chặn', () => {
    const text = [
      'try {',
      '    const F = Function;',
      '    new F("");',
      '    return true;',
      '  }',
      '  compile() {',
      '    const F = Function;',
      '    return 1 }',
      'const G = Function;',
    ].join('\n');
    const { blocked, allowed } = findEvalSites([{ name: 'pascalMount.js', text }]);

    expect(allowed).toHaveLength(2);
    expect(blocked).toHaveLength(1);
  });
});
