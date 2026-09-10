import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingHome from "./loading";

describe("LoadingHome", () => {
  it("hides the skeleton shapes from assistive tech and announces loading once, politely", () => {
    const { container } = render(<LoadingHome />);

    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Cargando…");
  });
});
