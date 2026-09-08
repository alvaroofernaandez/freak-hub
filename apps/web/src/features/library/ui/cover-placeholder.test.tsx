import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverPlaceholder } from "./cover-placeholder";

describe("CoverPlaceholder", () => {
  it("shows the placeholder label", () => {
    render(<CoverPlaceholder />);

    expect(screen.getByText("portada")).toBeInTheDocument();
  });

  it("applies the size classes passed in via className", () => {
    render(<CoverPlaceholder className="h-[78px] w-[58px]" />);

    const placeholder = screen.getByText("portada");
    expect(placeholder).toHaveClass("h-[78px]");
    expect(placeholder).toHaveClass("w-[58px]");
  });

  it("exposes the given test id", () => {
    render(<CoverPlaceholder testId="work-page-header-cover" />);

    expect(screen.getByTestId("work-page-header-cover")).toBeInTheDocument();
  });
});
