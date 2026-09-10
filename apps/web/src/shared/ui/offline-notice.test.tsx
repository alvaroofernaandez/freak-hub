import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const online = vi.fn<() => boolean>(() => true);
vi.mock("@/shared/lib/use-online-status", () => ({
  useOnlineStatus: () => online(),
}));

// use-offline-notice-visible.ts wraps useOnlineStatus directly, unmocked, so
// mocking useOnlineStatus above is enough to drive this component's states.

const { OfflineNotice } = await import("./offline-notice");

describe("OfflineNotice", () => {
  it("renders nothing while online and no recovery is pending", () => {
    online.mockReturnValue(true);
    render(<OfflineNotice />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a persistent, polite notice while offline", () => {
    online.mockReturnValue(false);
    render(<OfflineNotice />);

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(
      "Sin conexión. Lo que ves puede no estar al día.",
    );
    expect(notice).toHaveAttribute("aria-live", "polite");
  });

  it("shows a brief recovery notice after going back online, then clears itself", () => {
    vi.useFakeTimers();
    online.mockReturnValue(false);
    const { rerender } = render(<OfflineNotice />);
    expect(screen.getByRole("status")).toHaveTextContent(/sin conexión/i);

    online.mockReturnValue(true);
    rerender(<OfflineNotice />);
    expect(screen.getByRole("status")).toHaveTextContent(
      /conexión recuperada/i,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    rerender(<OfflineNotice />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
