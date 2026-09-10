import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadingProfile from "./loading";

describe("LoadingProfile", () => {
  it("hides the skeleton shapes from assistive tech and announces loading once, politely", () => {
    const { container } = render(<LoadingProfile />);

    expect(
      container.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando…");
  });
});
