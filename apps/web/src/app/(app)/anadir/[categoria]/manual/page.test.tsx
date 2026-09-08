import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: ManualAddPage } = await import("./page");

describe("ManualAddPage", () => {
  it("calls notFound for a category that does not exist", async () => {
    notFound.mockClear();
    await ManualAddPage({
      params: Promise.resolve({ categoria: "not-a-category" }),
    });

    expect(notFound).toHaveBeenCalled();
  });

  it("renders the common Work fields and a disabled submit button", async () => {
    notFound.mockClear();
    const page = await ManualAddPage({
      params: Promise.resolve({ categoria: "boardgame" }),
    });
    render(page);

    expect(screen.getByLabelText("Título")).toBeInTheDocument();
    expect(screen.getByLabelText("Año")).toBeInTheDocument();
    expect(screen.getByLabelText("Sinopsis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guardar/i })).toBeDisabled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("titles the page with the full add-flow trail", async () => {
    const page = await ManualAddPage({
      params: Promise.resolve({ categoria: "boardgame" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", {
        name: "Añadir · Juegos de mesa · Alta manual",
      }),
    ).toBeInTheDocument();
  });

  it("links back to the category's search screen", async () => {
    const page = await ManualAddPage({
      params: Promise.resolve({ categoria: "boardgame" }),
    });
    render(page);

    expect(screen.getByRole("link", { name: /volver/i })).toHaveAttribute(
      "href",
      "/anadir/boardgame",
    );
  });

  it("constrains the form to the mockup's max width", async () => {
    const page = await ManualAddPage({
      params: Promise.resolve({ categoria: "boardgame" }),
    });
    render(page);

    expect(screen.getByTestId("manual-add-form")).toHaveClass("max-w-[520px]");
  });

  it("gives the form labels the mono uppercase tracking pattern", async () => {
    const page = await ManualAddPage({
      params: Promise.resolve({ categoria: "boardgame" }),
    });
    render(page);

    expect(screen.getByText("Título")).toHaveClass(
      "font-mono",
      "uppercase",
      "tracking-widest",
    );
  });
});
