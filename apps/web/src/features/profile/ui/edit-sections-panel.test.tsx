import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditSectionsPanel, moveSection } from "./edit-sections-panel";
import { SECTION_ORDER } from "./section-tabs";

describe("EditSectionsPanel", () => {
  it("lists the sections in the member's own order, not the canonical one", () => {
    render(
      <EditSectionsPanel
        order={["top", "library", "recommendations", "activity"]}
        visibleSections={["top", "library"]}
        defaultSection="top"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getAllByTestId("section-name").map((row) => row.textContent),
    ).toEqual(["Top", "Biblioteca", "Recomendaciones", "Actividad"]);
  });

  it("moves a section to a new position, keeping the rest in order", () => {
    // dnd-kit's own sensors need real layout boxes, which jsdom does not
    // provide (every rect is 0x0), so the drag gesture itself is verified in
    // the browser. What can and should be tested here is the reordering the
    // gesture asks for.
    expect(moveSection(SECTION_ORDER, "library", "activity")).toEqual([
      "activity",
      "library",
      "top",
      "recommendations",
    ]);

    expect(moveSection(SECTION_ORDER, "recommendations", "library")).toEqual([
      "recommendations",
      "library",
      "activity",
      "top",
    ]);
  });

  it("leaves the order untouched when a section is dropped on itself", () => {
    expect(moveSection(SECTION_ORDER, "top", "top")).toEqual(SECTION_ORDER);
  });

  it("gives keyboard drag instructions in neutral Spanish, not dnd-kit's English default", () => {
    render(
      <EditSectionsPanel
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/pulsa la barra espaciadora/i)).toBeInTheDocument();
    expect(screen.queryByText(/press space/i)).not.toBeInTheDocument();
  });

  it("gives every row a drag handle a screen reader can name", () => {
    render(
      <EditSectionsPanel
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: /mover biblioteca/i }),
    ).toBeInTheDocument();
  });

  it("renders a checkbox per section, checked when visible", () => {
    render(
      <EditSectionsPanel
        visibleSections={["library", "top"]}
        defaultSection="library"
        onChange={vi.fn()}
      />,
    );

    for (const label of ["Biblioteca", "Top"]) {
      expect(screen.getByRole("checkbox", { name: label })).toBeChecked();
    }
    for (const label of ["Actividad", "Recomendaciones"]) {
      expect(screen.getByRole("checkbox", { name: label })).not.toBeChecked();
    }
  });

  it("unchecking a visible section removes it and keeps the default", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditSectionsPanel
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Top" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        visibleSections: ["library", "activity", "recommendations"],
        defaultSection: "library",
      }),
    );
  });

  it("falls back the default when its section is unchecked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditSectionsPanel
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Biblioteca" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        visibleSections: ["activity", "top", "recommendations"],
        defaultSection: "activity",
      }),
    );
  });

  it("disables the checkbox for the only remaining visible section", () => {
    render(
      <EditSectionsPanel
        visibleSections={["library"]}
        defaultSection="library"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Biblioteca" })).toBeDisabled();
  });

  it("does not call onChange when trying to hide the last visible section", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditSectionsPanel
        visibleSections={["library"]}
        defaultSection="library"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Biblioteca" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("offers only visible sections as the default section options", async () => {
    const user = userEvent.setup();
    render(
      <EditSectionsPanel
        visibleSections={["library", "top"]}
        defaultSection="library"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: "Sección que se abre por defecto",
    });
    expect(trigger).toHaveTextContent("Biblioteca");

    await user.click(trigger);

    expect(
      (await screen.findAllByRole("option")).map((o) => o.textContent),
    ).toEqual(["Biblioteca", "Top"]);
  });

  it("calls onChange with the new default section", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <EditSectionsPanel
        visibleSections={["library", "top"]}
        defaultSection="library"
        onChange={onChange}
      />,
    );

    await user.click(
      screen.getByRole("combobox", { name: "Sección que se abre por defecto" }),
    );
    await user.click(await screen.findByRole("option", { name: "Top" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        visibleSections: ["library", "top"],
        defaultSection: "top",
      }),
    );
  });
});
