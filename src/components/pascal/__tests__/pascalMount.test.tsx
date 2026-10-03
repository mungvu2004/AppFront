/**
 * Hợp đồng vòng đời của khung nhúng — `mount()` trả về gì, và `dispose()` dọn gì.
 *
 * Không dựng 3D ở đây: jsdom không có WebGL. `PascalFrame` trả `null` cho tới khi
 * cảnh nạp xong, nên mount rồi dispose ngay là đường đi hợp lệ và không chạm
 * canvas. Việc dựng hình đo bằng tay trong trình duyệt — lượt đo 2026-09-28 trên
 * chính bản dựng vách ngăn: `ready: true`, **0 yêu cầu đi ra ngoài**, tài sản lấy
 * từ `/pascal/material/` và `/basis/`.
 *
 * Cái tệp này canh: `dispose()` gọi hai lần không nổ, và nó trả store Pascal về
 * rỗng — vì màn hình rời đi mà cảnh cũ còn nằm trong store là một lỗi im lặng,
 * lượt vào sau sẽ thấy dữ liệu của lượt trước.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { createSampleBuilding } from '@/domain/spatial/__fixtures__/sampleBuilding';
import { toPascalScene } from '@/lib/pascal/toPascal';

import { mount } from '../pascalMount';
import { clearPascalScene } from '../pascalScene';

const sceneOf = () => toPascalScene(createSampleBuilding()).scene;

const elements: HTMLElement[] = [];
const host = (): HTMLElement => {
  const element = document.createElement('div');
  document.body.append(element);
  elements.push(element);
  return element;
};

afterEach(() => {
  for (const element of elements.splice(0)) element.remove();
  clearPascalScene();
});

describe('vòng đời khung nhúng Pascal', () => {
  it('trả về một tay cầm có đủ `setScene` và `dispose`', () => {
    const handle = mount(host(), { scene: sceneOf() });

    expect(typeof handle.setScene).toBe('function');
    expect(typeof handle.dispose).toBe('function');

    handle.dispose();
  });

  it('`dispose()` gọi hai lần không nổ', () => {
    const handle = mount(host(), { scene: sceneOf() });

    handle.dispose();
    expect(() => handle.dispose()).not.toThrow();
  });

  it('`setScene()` sau khi đã dispose thì im lặng bỏ qua, không dựng lại', () => {
    const handle = mount(host(), { scene: sceneOf() });
    handle.dispose();

    expect(() => handle.setScene(sceneOf())).not.toThrow();
  });

  it('`dispose()` trả store Pascal về rỗng', async () => {
    const handle = mount(host(), { scene: sceneOf() });
    handle.dispose();

    const { default: useScene } = await import('@pascal-app/core/store');
    expect(Object.keys(useScene.getState().nodes)).toHaveLength(0);
  });
});
