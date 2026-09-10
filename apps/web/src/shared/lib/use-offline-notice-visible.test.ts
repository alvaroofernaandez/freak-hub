import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const online = vi.fn<() => boolean>(() => true);
vi.mock("@/shared/lib/use-online-status", () => ({
  useOnlineStatus: () => online(),
}));

const { useOfflineNoticeVisible } = await import(
  "./use-offline-notice-visible"
);

describe("useOfflineNoticeVisible", () => {
  beforeEach(() => {
    online.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is not visible while online and no recovery is pending", () => {
    const { result } = renderHook(() => useOfflineNoticeVisible());

    expect(result.current.visible).toBe(false);
    expect(result.current.online).toBe(true);
  });

  it("is visible while offline", () => {
    online.mockReturnValue(false);
    const { result } = renderHook(() => useOfflineNoticeVisible());

    expect(result.current.visible).toBe(true);
    expect(result.current.online).toBe(false);
  });

  it("stays visible briefly after recovering, then clears itself", () => {
    vi.useFakeTimers();
    online.mockReturnValue(false);
    const { result, rerender } = renderHook(() => useOfflineNoticeVisible());
    expect(result.current.visible).toBe(true);

    online.mockReturnValue(true);
    rerender();
    expect(result.current.visible).toBe(true);
    expect(result.current.online).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    rerender();
    expect(result.current.visible).toBe(false);
  });
});
