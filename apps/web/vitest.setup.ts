import "@testing-library/jest-dom/vitest";

import { render } from "@testing-library/react";
import { domMax, LazyMotion, MotionGlobalConfig } from "motion/react";
import { createElement } from "react";

/**
 * ADR-0012: components in this suite are rendered directly, without the
 * app's <MotionProvider> ancestor. Motion's feature registration
 * (`loadFeatures`, called by `LazyMotion`) writes to a module-level
 * singleton in `motion-dom`, not to React context, so mounting `LazyMotion`
 * once, anywhere, in this worker process is enough for every `m.*`
 * component rendered afterwards in any test of this file to gain full
 * animation, exit, and layout support — the same behaviour production gets
 * from the root provider. `setupFiles` re-runs per test file, so this runs
 * once per file, which is the granularity that matters here.
 *
 * Without this, `m.*` elements inside `AnimatePresence` in components that
 * rely on `domMax`-only features (layout, layoutId, drag) would never
 * resolve their exit or layout animations, so `AnimatePresence` would never
 * unmount them and any test asserting an element's disappearance would hang
 * until it timed out.
 */
const { unmount } = render(createElement(LazyMotion, { features: domMax }));
unmount();

/**
 * Skip animations outright: tests assert on the settled DOM, never on an
 * animation mid-flight, so there is nothing to gain from waiting out a real
 * transition. `AnimatePresence` still unmounts asynchronously even with this
 * on (the completion still lands on a later tick), so tests that assert an
 * element's disappearance still need `waitFor`/`waitForElementToBeRemoved`
 * rather than a synchronous assertion right after the triggering event.
 */
MotionGlobalConfig.skipAnimations = true;

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
