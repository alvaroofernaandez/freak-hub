import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./use-media-query";

type Listener = (event: MediaQueryListEvent) => void;

function mockMatchMedia(initialMatches: boolean) {
  const listeners: Listener[] = [];
  const mql = {
    matches: initialMatches,
    media: "",
    addEventListener: vi.fn((_event: string, listener: Listener) => {
      listeners.push(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: Listener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }),
  };
  window.matchMedia = vi
    .fn()
    .mockReturnValue(mql) as unknown as typeof window.matchMedia;

  return {
    fireChange(matches: boolean) {
      mql.matches = matches;
      for (const listener of listeners) {
        listener({ matches } as MediaQueryListEvent);
      }
    },
  };
}

describe("useMediaQuery", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the current match state from matchMedia after mount", () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useMediaQuery("(min-width: 640px)"));

    expect(result.current).toBe(true);
  });

  it("updates when the media query's match state changes", () => {
    const { fireChange } = mockMatchMedia(false);

    const { result } = renderHook(() => useMediaQuery("(min-width: 640px)"));
    expect(result.current).toBe(false);

    act(() => {
      fireChange(true);
    });

    expect(result.current).toBe(true);
  });

  it("falls back to the initial value when matchMedia is unavailable, instead of throwing", () => {
    // jsdom does not implement `matchMedia` unless a test stubs it (most of
    // this suite's tests don't need to). A caller that mounts unconditionally
    // — `AddCategoryModalHost`, always rendered in the app shell — must not
    // crash those tests just because this hook runs.
    delete (window as { matchMedia?: unknown }).matchMedia;

    const { result } = renderHook(() =>
      useMediaQuery("(min-width: 640px)", true),
    );

    expect(result.current).toBe(true);
  });

  it("stops listening on unmount", () => {
    mockMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery("(min-width: 640px)"));
    const mql = (window.matchMedia as ReturnType<typeof vi.fn>).mock.results[0]
      .value;

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
