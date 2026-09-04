import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: WorkPage } = await import("./page");

describe("WorkPage", () => {
  beforeEach(() => {
    notFound.mockClear();
  });

  it("calls notFound for an id that does not exist", async () => {
    await WorkPage({ params: Promise.resolve({ id: "does-not-exist" }) });

    expect(notFound).toHaveBeenCalled();
  });

  it("renders the title and status for a work that exists", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "anime-fma" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", {
        name: "Fullmetal Alchemist: Brotherhood",
      }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("shows Expansiones for a base boardgame that has one", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "board-wingspan" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: "Expansiones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Wingspan: European Expansion"),
    ).toBeInTheDocument();
  });

  it("does not show Expansiones for an expansion itself", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "board-wingspan-european" }),
    });
    render(page);

    expect(
      screen.queryByRole("heading", { name: "Expansiones" }),
    ).not.toBeInTheDocument();
  });

  it("shows Mazos for a tcg work that has decks", async () => {
    const page = await WorkPage({ params: Promise.resolve({ id: "tcg-mtg" }) });
    render(page);

    expect(screen.getByRole("heading", { name: "Mazos" })).toBeInTheDocument();
    expect(screen.getByText("Mono-Rojo Agresivo")).toBeInTheDocument();
  });

  it("does not show Expansiones or Mazos for a work outside those categories", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "anime-fma" }),
    });
    render(page);

    expect(
      screen.queryByRole("heading", { name: "Expansiones" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Mazos" }),
    ).not.toBeInTheDocument();
  });
});
