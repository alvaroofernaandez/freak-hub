import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditSectionsPanel } from "./edit-sections-panel";
import { SECTION_ORDER } from "./section-tabs";

describe("EditSectionsPanel", () => {
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

    expect(onChange).toHaveBeenCalledWith({
      visibleSections: ["library", "activity", "recommendations"],
      defaultSection: "library",
    });
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

    expect(onChange).toHaveBeenCalledWith({
      visibleSections: ["activity", "top", "recommendations"],
      defaultSection: "activity",
    });
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

  it("offers only visible sections as the default section options", () => {
    render(
      <EditSectionsPanel
        visibleSections={["library", "top"]}
        defaultSection="library"
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByLabelText(
      "Sección que se abre por defecto",
    ) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);

    expect(optionLabels).toEqual(["Biblioteca", "Top"]);
    expect(select.value).toBe("library");
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

    await user.selectOptions(
      screen.getByLabelText("Sección que se abre por defecto"),
      "top",
    );

    expect(onChange).toHaveBeenCalledWith({
      visibleSections: ["library", "top"],
      defaultSection: "top",
    });
  });
});
