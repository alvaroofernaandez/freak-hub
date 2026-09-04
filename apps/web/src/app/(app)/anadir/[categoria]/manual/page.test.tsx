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
});
