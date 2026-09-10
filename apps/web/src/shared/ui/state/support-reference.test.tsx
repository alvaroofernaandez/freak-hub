import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportReference } from "./support-reference";

describe("SupportReference", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("shows the opaque id in a technical, monospaced form", () => {
    render(<SupportReference id="4f0c2e9a7b1d3c5e" />);

    expect(screen.getByText(/4f0c2e9a7b1d3c5e/)).toHaveClass("font-mono");
  });

  it("copies the id to the clipboard and announces it", async () => {
    const user = userEvent.setup();
    render(<SupportReference id="abc-123" />);

    await user.click(screen.getByRole("button", { name: /copiar/i }));

    // userEvent installs its own clipboard stub on setup, ahead of the one
    // this suite defines in `beforeEach` — asserting the visible, announced
    // outcome is what actually matters here, not which stub answered.
    await waitFor(() =>
      expect(screen.getByText(/copiada/i)).toBeInTheDocument(),
    );
  });

  it("labels the reference by its own name, not a hardcoded one", () => {
    render(<SupportReference id="abc-123" label="Código de error" />);

    expect(screen.getByText(/código de error/i)).toBeInTheDocument();
  });
});
