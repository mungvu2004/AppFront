/**
 * BUG-482 — camera của khung Pascal đóng khung mô hình khi cảnh sẵn sàng.
 *
 * jsdom không có WebGL, nên `useThree` và hai hàm khung hình của Pascal được giả:
 * thứ bài này canh là DÂY NỐI — chưa sẵn sàng thì không đụng camera, sẵn sàng thì
 * đặt đúng tư thế `heroCameraPose` trả về, với tỷ lệ của chính khung.
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const camera = {
  lookAt: vi.fn(),
  position: { set: vi.fn() },
  updateMatrixWorld: vi.fn(),
};
const size = { height: 812, width: 375 };

vi.mock('@react-three/fiber', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useThree: (select: (state: unknown) => unknown) => select({ camera, size }),
}));

const pose = { position: [1, 2, 3] as const, target: [4, 5, 6] as const };
const framing = { aim: [0, 1, 0], azimuthRad: 0.5, boxes: [] };

vi.mock('@pascal-app/viewer', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  computeHeroFraming: vi.fn(() => framing),
  heroCameraPose: vi.fn(() => pose),
}));

const viewer = await import('@pascal-app/viewer');
const { HeroCamera } = await import('../PascalFrame');

describe('[BUG-482] HeroCamera', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('chưa sẵn sàng thì không đụng camera', () => {
    render(<HeroCamera ready={false} />);

    expect(camera.position.set).not.toHaveBeenCalled();
  });

  it('sẵn sàng thì đặt camera theo heroCameraPose, với tỷ lệ của khung', () => {
    render(<HeroCamera ready />);

    expect(viewer.heroCameraPose).toHaveBeenCalledWith(
      expect.objectContaining({ aspect: size.width / size.height, boxes: framing.boxes }),
    );
    expect(camera.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(camera.lookAt).toHaveBeenCalledWith(4, 5, 6);
  });

  it('mặc định (hero) ngắm tâm toà nhà, giữ góc thấp của ảnh đại diện', () => {
    render(<HeroCamera ready />);

    const args = vi.mocked(viewer.heroCameraPose).mock.calls[0]?.[0];
    expect(args).toMatchObject({ aim: framing.aim });
    expect(args).not.toHaveProperty('elevationRad');
    expect(args).not.toHaveProperty('padding');
  });

  it('[V1c] fit="scene" vừa khung bao cả cảnh: bỏ aim, nhìn cao hơn, chừa lề', () => {
    render(<HeroCamera ready fit="scene" />);

    const args = vi.mocked(viewer.heroCameraPose).mock.calls[0]?.[0];
    expect(args).not.toHaveProperty('aim');
    expect(args).toMatchObject({ boxes: framing.boxes, elevationRad: Math.PI / 6, padding: 1.15 });
    expect(camera.position.set).toHaveBeenCalledWith(1, 2, 3);
  });
});
