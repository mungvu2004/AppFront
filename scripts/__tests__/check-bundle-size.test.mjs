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

import { describe, expect, it } from 'vitest';

import { baselineFor, closure, closureGzip, presentWhenLoaded } from '../check-bundle-size.mjs';

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
