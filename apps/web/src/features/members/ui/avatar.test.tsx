import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("renders an image with an accessible name when given an image URL", () => {
    render(
      <Avatar displayName="Edward Elric" imageUrl="https://example.com/ed.png" />,
    );

    const image = screen.getByRole("img", { name: "Edward Elric" });
    expect(image).toHaveAttribute("src", "https://example.com/ed.png");
  });

  it("renders initials when there is no image URL", () => {
    render(<Avatar displayName="Edward Elric" imageUrl={null} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("EE")).toBeInTheDocument();
  });

  it("renders initials when the image URL is omitted", () => {
    render(<Avatar displayName="Gon Freecss" />);

    expect(screen.getByText("GF")).toBeInTheDocument();
  });

  it("takes a single initial from a one-word name", () => {
    render(<Avatar displayName="Gon" />);

    expect(screen.getByText("G")).toBeInTheDocument();
  });
});
