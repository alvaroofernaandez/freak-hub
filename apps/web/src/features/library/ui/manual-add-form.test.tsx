import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ManualEntryFormState } from "@/features/library/actions/create-manual-entry";

const createManualEntry = vi.fn();
vi.mock("@/features/library/actions/create-manual-entry", () => ({
  createManualEntry: (state: ManualEntryFormState, data: FormData) =>
    createManualEntry(state, data),
}));

const { ManualAddForm } = await import("./manual-add-form");

function submittedFields(): Record<string, string> {
  const [, data] = createManualEntry.mock.calls.at(-1) as [
    ManualEntryFormState,
    FormData,
  ];
  return Object.fromEntries(
    [...data.entries()].map(([key, value]) => [key, String(value)]),
  );
}

describe("ManualAddForm", () => {
  beforeEach(() => {
    createManualEntry.mockResolvedValue({ status: "idle", message: "" });
  });

  it("asks for a status, because the contract requires one and has no default", () => {
    render(<ManualAddForm category="boardgame" />);

    expect(screen.getByRole("radiogroup", { name: /estado/i })).toBeVisible();
  });

  it("offers all six statuses, since creating an entry is not a transition", () => {
    render(<ManualAddForm category="boardgame" />);

    for (const label of [
      "Wishlist",
      "Pendiente",
      "En curso",
      "Terminado",
      "Abandonado",
      "En pausa",
    ]) {
      expect(screen.getByRole("radio", { name: label })).toBeEnabled();
    }
  });

  it("starts with nothing chosen rather than guessing a status for you", () => {
    render(<ManualAddForm category="boardgame" />);

    for (const label of ["Wishlist", "Pendiente", "Terminado"]) {
      expect(screen.getByRole("radio", { name: label })).not.toBeChecked();
    }
  });

  it("sends what was typed, the chosen status and the category from the route", async () => {
    render(<ManualAddForm category="boardgame" />);

    await userEvent.type(screen.getByLabelText("Título"), "Brass: Birmingham");
    await userEvent.type(screen.getByLabelText("Año"), "2018");
    await userEvent.type(
      screen.getByLabelText("Sinopsis"),
      "Canales y raíles.",
    );
    await userEvent.click(screen.getByRole("radio", { name: "Pendiente" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(createManualEntry).toHaveBeenCalled());
    expect(submittedFields()).toMatchObject({
      title: "Brass: Birmingham",
      year: "2018",
      synopsis: "Canales y raíles.",
      status: "pending",
      category: "boardgame",
    });
  });

  it("keeps what was typed after a recoverable failure, instead of emptying the form", async () => {
    createManualEntry.mockResolvedValue({
      status: "error",
      message: "No se ha podido crear la obra. Inténtalo de nuevo.",
    });
    render(<ManualAddForm category="boardgame" />);

    await userEvent.type(screen.getByLabelText("Título"), "Brass: Birmingham");
    await userEvent.click(screen.getByRole("radio", { name: "Pendiente" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Título")).toHaveValue("Brass: Birmingham");
    expect(screen.getByRole("radio", { name: "Pendiente" })).toBeChecked();
  });

  it("shows a field error on its own field and moves the focus there", async () => {
    createManualEntry.mockResolvedValue({
      status: "error",
      message: "Escribe un título.",
      fieldErrors: [{ field: "title", message: "Escribe un título." }],
    });
    render(<ManualAddForm category="boardgame" />);

    // Whitespace satisfies the field's own `required`, and the action trims
    // before checking: exactly the case where only the server can object.
    await userEvent.type(screen.getByLabelText("Título"), "   ");
    await userEvent.click(screen.getByRole("radio", { name: "Pendiente" }));
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    const title = screen.getByLabelText("Título");
    await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"));
    expect(title).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Escribe un título.");
  });

  it("does not repeat a field error as a form-level message", async () => {
    createManualEntry.mockResolvedValue({
      status: "error",
      message: "Escribe un título.",
      fieldErrors: [{ field: "title", message: "Escribe un título." }],
    });
    render(<ManualAddForm category="boardgame" />);

    await userEvent.type(screen.getByLabelText("Título"), "   ");
    await userEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() =>
      expect(screen.getAllByText("Escribe un título.")).toHaveLength(1),
    );
  });

  it("says how long a title and a synopsis may be, taking the bounds from the contract", () => {
    render(<ManualAddForm category="boardgame" />);

    expect(screen.getByLabelText("Título")).toHaveAttribute("maxLength", "300");
    expect(screen.getByLabelText("Sinopsis")).toHaveAttribute(
      "maxLength",
      "5000",
    );
  });

  it("bounds the year field to the years the contract accepts", () => {
    render(<ManualAddForm category="boardgame" />);

    const year = screen.getByLabelText("Año");
    expect(year).toHaveAttribute("min", "1800");
    expect(year).toHaveAttribute("max", "2200");
  });
});
