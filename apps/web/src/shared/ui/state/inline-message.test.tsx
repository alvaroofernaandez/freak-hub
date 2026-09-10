import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineMessage } from "./inline-message";

describe("InlineMessage", () => {
  it("uses role=alert for an error that appeared after a user action", () => {
    render(
      <InlineMessage tone="error" afterUserAction>
        No se ha podido guardar.
      </InlineMessage>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se ha podido guardar.",
    );
  });

  it("uses role=status for an error that was already there (not after a user action)", () => {
    render(<InlineMessage tone="error">No se ha podido cargar.</InlineMessage>);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("uses role=status for success and info, never alert", () => {
    const { rerender } = render(
      <InlineMessage tone="success">Guardado.</InlineMessage>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Guardado.");

    rerender(<InlineMessage tone="info">Nota.</InlineMessage>);
    expect(screen.getByRole("status")).toHaveTextContent("Nota.");
  });

  it("carries a distinct token per tone, never color alone", () => {
    const { container: error } = render(
      <InlineMessage tone="error">e</InlineMessage>,
    );
    const { container: warning } = render(
      <InlineMessage tone="warning">w</InlineMessage>,
    );
    const { container: success } = render(
      <InlineMessage tone="success">s</InlineMessage>,
    );

    expect(error.firstElementChild).toHaveClass("text-danger");
    expect(warning.firstElementChild).toHaveClass("text-warning");
    expect(success.firstElementChild).toHaveClass("text-success");
  });

  it("lets a compact surface (a popover) override the default text size", () => {
    render(
      <InlineMessage tone="success" className="text-xs">
        Enviado.
      </InlineMessage>,
    );

    expect(screen.getByRole("status")).toHaveClass("text-xs");
  });
});
