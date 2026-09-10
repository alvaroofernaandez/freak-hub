import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./select";

const OPTIONS = [
  { value: "library", label: "Biblioteca" },
  { value: "activity", label: "Actividad" },
];

describe("Select", () => {
  it("exposes a combobox showing the current choice", () => {
    render(
      <Select
        value="library"
        onValueChange={() => {}}
        options={OPTIONS}
        label="Sección por defecto"
      />,
    );

    const trigger = screen.getByRole("combobox", {
      name: /sección por defecto/i,
    });
    expect(trigger).toHaveTextContent("Biblioteca");
  });

  it("opens its own list, never the browser's", async () => {
    render(
      <Select
        value="library"
        onValueChange={() => {}}
        options={OPTIONS}
        label="Sección por defecto"
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));

    // A native <select> would give us no listbox role in the document.
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    expect(document.querySelector("select")).toBeNull();
  });

  it("reports the option chosen", async () => {
    const onValueChange = vi.fn();
    render(
      <Select
        value="library"
        onValueChange={onValueChange}
        options={OPTIONS}
        label="Sección por defecto"
      />,
    );

    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(
      await screen.findByRole("option", { name: "Actividad" }),
    );

    expect(onValueChange).toHaveBeenCalledWith("activity");
  });

  it("keeps its list mounted through the exit animation, instead of removing it the instant it closes", () => {
    render(
      <Select
        value="library"
        onValueChange={() => {}}
        options={OPTIONS}
        label="Sección por defecto"
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Radix's outside-dismiss detection listens for `pointerdown`, not
    // `click`. The rest of the document is `aria-hidden` while the list is
    // open, so target `document.body` directly rather than a queried role.
    fireEvent.pointerDown(document.body, { button: 0, pointerId: 1 });

    // Synchronous check, no `await`: the list exits through Motion, it
    // does not vanish the instant it closes.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});
