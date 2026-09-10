import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { RetryButton } = await import("./retry-button");

describe("RetryButton", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("calls router.refresh by default", async () => {
    const user = userEvent.setup();
    render(<RetryButton />);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(refresh).toHaveBeenCalled();
  });

  it("calls a custom onRetry instead of refreshing, when given", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<RetryButton onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onRetry).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a pending label while an async retry is in flight, and disables the button", async () => {
    let resolveRetry: () => void = () => {};
    const onRetry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        }),
    );
    const user = userEvent.setup();
    render(<RetryButton onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());

    resolveRetry();
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("is a real button, reachable and activatable by keyboard", async () => {
    const user = userEvent.setup();
    render(<RetryButton />);

    await user.tab();

    expect(screen.getByRole("button", { name: "Reintentar" })).toHaveFocus();
  });

  it("reserves its idle label's width so the button does not resize while pending", () => {
    render(<RetryButton />);

    expect(
      screen.getByText("Reintentar", { selector: "[aria-hidden='true']" }),
    ).toBeInTheDocument();
  });

  describe("retryAfterSeconds (Problem's Retry-After, ADR-0014)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("stays disabled and explains why, until retryAfterSeconds elapses", () => {
      vi.useFakeTimers();
      render(<RetryButton retryAfterSeconds={30} />);

      const button = screen.getByRole("button", { name: "Reintentar" });
      expect(button).toBeDisabled();
      expect(screen.getByRole("status")).toHaveTextContent(
        /podrás reintentarlo/i,
      );

      act(() => {
        vi.advanceTimersByTime(29_000);
      });
      expect(button).toBeDisabled();

      act(() => {
        vi.advanceTimersByTime(1_000);
      });
      expect(button).not.toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("is enabled immediately when there is no retryAfterSeconds", () => {
      render(<RetryButton />);

      expect(
        screen.getByRole("button", { name: "Reintentar" }),
      ).not.toBeDisabled();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("announces the wait once — the message does not change every second", () => {
      vi.useFakeTimers();
      render(<RetryButton retryAfterSeconds={10} />);

      const firstText = screen.getByRole("status").textContent;

      act(() => {
        vi.advanceTimersByTime(4_000);
      });

      expect(screen.getByRole("status").textContent).toBe(firstText);
    });

    it("cleans up its timer on unmount", () => {
      vi.useFakeTimers();
      const clearSpy = vi.spyOn(window, "clearTimeout");
      const { unmount } = render(<RetryButton retryAfterSeconds={30} />);

      unmount();

      expect(clearSpy).toHaveBeenCalled();
      clearSpy.mockRestore();
    });
  });
});
