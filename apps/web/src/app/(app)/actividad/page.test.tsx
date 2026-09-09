import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const { default: ActivityPage } = await import("./page");

describe("ActivityPage", () => {
  it("keeps the page heading and subtitle", async () => {
    const page = await ActivityPage();
    render(page);

    expect(
      screen.getByRole("heading", { name: "Actividad" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Todo lo que ha pasado en el grupo."),
    ).toBeInTheDocument();
  });

  it("shows the feed's empty state, since there is no activity endpoint yet", async () => {
    const page = await ActivityPage();
    render(page);

    expect(screen.getByText(/sin actividad todavía/i)).toBeInTheDocument();
  });
});
