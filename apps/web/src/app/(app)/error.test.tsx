import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { default: AppError } = await import("./error");

describe("(app) module error boundary", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  it("shows normalized, non-technical copy — never the raw error message", () => {
    render(
      <AppError
        error={new Error("TypeError: x.y is undefined")}
        reset={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading")).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });

  it("retries via reset() and router.refresh() together", async () => {
    const reset = vi.fn();
    const user = userEvent.setup();
    render(<AppError error={new Error("boom")} reset={reset} />);

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(reset).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the error's digest as the support reference, when there is one", () => {
    const error = Object.assign(new Error("boom"), { digest: "dig-456" });
    render(<AppError error={error} reset={vi.fn()} />);

    expect(screen.getByText(/dig-456/)).toBeInTheDocument();
  });
});
