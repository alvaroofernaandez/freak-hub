import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { ErrorState } = await import("./error-state");

const RETRYABLE = {
  kind: "service_unavailable" as const,
  severity: "critical" as const,
  scope: "section" as const,
  code: "upstream_unavailable" as const,
  retryable: true,
  copy: {
    title: "Servicio no disponible",
    description: "Vuelve a intentarlo.",
  },
  recovery: { kind: "retry" as const },
  correlationId: "corr-abc",
};

const NON_RETRYABLE = {
  kind: "conflict" as const,
  severity: "info" as const,
  scope: "operation" as const,
  code: "username_taken" as const,
  retryable: false,
  copy: { title: "Nombre en uso", description: "Prueba con otro." },
  recovery: { kind: "none" as const },
};

describe("ErrorState", () => {
  it("shows the normalized title and description", () => {
    render(<ErrorState error={RETRYABLE} size="section" />);

    expect(
      screen.getByRole("heading", { name: "Servicio no disponible" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vuelve a intentarlo.")).toBeInTheDocument();
  });

  it("shows a retry button only when the recovery is retry", () => {
    const { rerender } = render(
      <ErrorState error={RETRYABLE} size="section" />,
    );
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();

    rerender(<ErrorState error={NON_RETRYABLE} size="section" />);
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("shows a support reference only when a correlation id is present", () => {
    const { rerender } = render(
      <ErrorState error={RETRYABLE} size="section" />,
    );
    expect(screen.getByText(/corr-abc/)).toBeInTheDocument();

    rerender(<ErrorState error={NON_RETRYABLE} size="section" />);
    expect(screen.queryByText(/Referencia/)).not.toBeInTheDocument();
  });

  it("keeps the retry disabled until the Problem's retryAfter elapses", () => {
    render(
      <ErrorState error={{ ...RETRYABLE, retryAfter: 30 }} size="section" />,
    );

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      /podrás reintentarlo/i,
    );
  });
});
