import { afterEach, describe, expect, it, vi } from 'vitest';

import { watchPresence } from '../presence';

/** A stand-in `IntersectionObserver` the test can fire by hand. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  readonly observed: Element[] = [];
  readonly disconnect = vi.fn();

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element): void {
    this.observed.push(element);
  }

  fire(isIntersecting: boolean): void {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

function installObserver(): void {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

afterEach(() => {
  vi.unstubAllGlobals();
  setVisibility('visible');
});

describe('watchPresence', () => {
  it('reports the document visible at once, and again on every change', () => {
    const report = vi.fn();
    const handle = watchPresence(document.createElement('canvas'), report);

    expect(report).toHaveBeenCalledWith('visible', true);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(report).toHaveBeenLastCalledWith('visible', false);

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(report).toHaveBeenLastCalledWith('visible', true);

    handle.dispose();
  });

  it('closes the focused gate on blur and opens it on focus, without claiming the initial state', () => {
    const report = vi.fn();
    const handle = watchPresence(document.createElement('canvas'), report);

    expect(report.mock.calls.some(([gate]) => gate === 'focused')).toBe(false);

    window.dispatchEvent(new Event('blur'));
    expect(report).toHaveBeenLastCalledWith('focused', false);
    window.dispatchEvent(new Event('focus'));
    expect(report).toHaveBeenLastCalledWith('focused', true);

    handle.dispose();
  });

  it('observes the canvas and reports the last intersection entry', () => {
    installObserver();
    const canvas = document.createElement('canvas');
    const report = vi.fn();
    const handle = watchPresence(canvas, report);

    const observer = FakeIntersectionObserver.instances[0]!;
    expect(observer.observed).toEqual([canvas]);

    observer.fire(false);
    expect(report).toHaveBeenLastCalledWith('onScreen', false);
    observer.fire(true);
    expect(report).toHaveBeenLastCalledWith('onScreen', true);

    handle.dispose();
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('leaves the onScreen gate alone where the page has no IntersectionObserver', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const report = vi.fn();
    const handle = watchPresence(document.createElement('canvas'), report);

    expect(report.mock.calls.some(([gate]) => gate === 'onScreen')).toBe(false);
    handle.dispose();
  });

  it('stops reporting after dispose', () => {
    const report = vi.fn();
    const handle = watchPresence(document.createElement('canvas'), report);
    handle.dispose();
    const calls = report.mock.calls.length;

    window.dispatchEvent(new Event('blur'));
    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(report).toHaveBeenCalledTimes(calls);
  });
});
