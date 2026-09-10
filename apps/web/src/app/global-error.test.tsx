import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("shows a plain reload action, with no technical detail visible", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /recargar/i }),
    ).toBeInTheDocument();
  });

  it("calls reset when the reload action is used", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<GlobalError error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: /recargar/i }));

    expect(reset).toHaveBeenCalled();
  });

  it("shows the error's digest as a support reference, when there is one", () => {
    const error = Object.assign(new Error("boom"), { digest: "dig-123" });
    render(<GlobalError error={error} reset={vi.fn()} />);

    expect(screen.getByText(/dig-123/)).toBeInTheDocument();
  });

  it("renders its own html and body, replacing the root layout entirely", () => {
    render(<GlobalError error={new Error("boom")} reset={vi.fn()} />);

    expect(screen.getByRole("heading").closest("body")).not.toBeNull();
    expect(screen.getByRole("heading").closest("html")).not.toBeNull();
  });
});
