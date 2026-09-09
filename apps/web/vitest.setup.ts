import "@testing-library/jest-dom/vitest";

/**
 * Node 25 ships a `localStorage` global gated by `--localstorage-file`
 * (see https://nodejs.org/api/globals.html#localstorage). Without a valid
 * path it still defines the global, but as a stub missing methods like
 * `clear`, and jsdom's `window` picks up that broken stub instead of a
 * working storage mock. Any test calling `window.localStorage.clear()` then
 * throws `TypeError: window.localStorage.clear is not a function`.
 *
 * Replace it with a small in-memory implementation before any test runs, so
 * `window.localStorage` behaves like the real thing regardless of the Node
 * version running the suite.
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) ?? null) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

Object.defineProperty(window, "localStorage", {
  value: new MemoryStorage(),
  writable: true,
});

/**
 * jsdom implements neither the Pointer Capture API nor `scrollIntoView`, and
 * has no ResizeObserver. Radix's popper-based primitives (Select, Dropdown
 * Menu) call all three while opening, so without these stubs the list simply
 * never appears and every test on them fails with "unable to find role".
 *
 * These are test-environment gaps, not application behaviour: a real browser
 * provides all of them.
 */
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
