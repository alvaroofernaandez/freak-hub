import { render, screen, within } from "@testing-library/react";
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
    expect(screen.getByTestId("active-category")).toHaveAttribute(
      "data-category",
      "anime",
    );
  });

  it("renders a two-column header with a cover placeholder and the category pill", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "board-wingspan" }),
    });
    render(page);

    expect(screen.getByText("portada")).toBeInTheDocument();
    expect(screen.getByText("Juegos de mesa")).toBeInTheDocument();
  });

  it("shows the boardgame's metadata and source attribution lines", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "board-wingspan" }),
    });
    render(page);

    expect(
      screen.getByText("2019 · 40–70 min · 1–5 jugadores · Stonemaier Games"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fuente: BoardGameGeek")).toBeInTheDocument();
  });

  it("keeps the status, rating and favourite star below the header", async () => {
    const page = await WorkPage({
      params: Promise.resolve({ id: "board-wingspan" }),
    });
    render(page);

    const statusRow = within(screen.getByTestId("work-page-status-row"));
    expect(statusRow.getByText("Terminado")).toBeInTheDocument();
    expect(statusRow.getByText("9/10")).toBeInTheDocument();
    expect(statusRow.getByLabelText("Favorito")).toBeInTheDocument();
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
