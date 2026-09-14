import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => currentUser(),
}));

const { default: RecommendationsPage } = await import("./page");

describe("RecommendationsPage", () => {
  beforeEach(() => {
    currentUser.mockReset();
    currentUser.mockResolvedValue({ username: "alvaro" });
  });

  it("names the screen and says what it is for", async () => {
    render(await RecommendationsPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Recomendaciones" }),
    ).toBeInTheDocument();
  });

  it("carries the two blocks docs/screens.md asks for", async () => {
    render(await RecommendationsPage());

    expect(
      screen.getByRole("heading", { level: 2, name: /recibidas pendientes/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: /enviadas/i }),
    ).toBeInTheDocument();
  });

  it("shows both empty states, since there is no recommendations endpoint yet", async () => {
    render(await RecommendationsPage());

    expect(screen.getByText(/nada pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/no has recomendado nada/i)).toBeInTheDocument();
  });

  it("offers no accept or dismiss action, because no endpoint answers one", async () => {
    render(await RecommendationsPage());

    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("still renders when Clerk has no username for the session", async () => {
    currentUser.mockResolvedValue(null);

    render(await RecommendationsPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Recomendaciones" }),
    ).toBeInTheDocument();
  });
});
