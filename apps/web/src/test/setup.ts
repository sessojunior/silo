import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

if (typeof window.requestAnimationFrame !== "function") {
  window.requestAnimationFrame = (callback: FrameRequestCallback): number =>
    window.setTimeout(() => callback(performance.now()), 0);
}

if (typeof window.cancelAnimationFrame !== "function") {
  window.cancelAnimationFrame = (handle: number): void => {
    window.clearTimeout(handle);
  };
}