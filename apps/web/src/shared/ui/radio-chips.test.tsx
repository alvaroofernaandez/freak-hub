import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RadioChips } from "./radio-chips";

const OPTIONS = [
  { value: "one", label: "Uno" },
  { value: "two", label: "Dos" },
  { value: "three", label: "Tres" },
];

function setup(overrides: Partial<Parameters<typeof RadioChips>[0]> = {}) {
  const onValueChange = vi.fn();
  render(
    <RadioChips
      label="Elige"
      value="one"
      onValueChange={onValueChange}
      options={OPTIONS}
      {...overrides}
    />,
  );
  return { onValueChange };
}

describe("RadioChips", () => {
  it("is a radiogroup that says what it is choosing", () => {
    setup();

    expect(screen.getByRole("radiogroup", { name: "Elige" })).toBeVisible();
  });

  it("marks exactly the selected option, so the choice is never implied by colour alone", () => {
    setup({ value: "two" });

    expect(screen.getByRole("radio", { name: "Dos" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Uno" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Tres" })).not.toBeChecked();
  });

  it("reports the option that was pressed", async () => {
    const { onValueChange } = setup();

    await userEvent.click(screen.getByRole("radio", { name: "Tres" }));

    expect(onValueChange).toHaveBeenCalledWith("three");
  });

  it("disables an unavailable option instead of hiding it, so the shape of the choice stays visible", async () => {
    const { onValueChange } = setup({ unavailable: ["three"] });

    const unavailable = screen.getByRole("radio", { name: "Tres" });
    expect(unavailable).toBeDisabled();

    await userEvent.click(unavailable);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps every option pressable while nothing is marked unavailable", () => {
    setup();

    for (const { label } of OPTIONS) {
      expect(screen.getByRole("radio", { name: label })).toBeEnabled();
    }
  });

  it("disables the whole group while a save is in flight", async () => {
    const { onValueChange } = setup({ disabled: true });

    for (const { label } of OPTIONS) {
      expect(screen.getByRole("radio", { name: label })).toBeDisabled();
    }

    await userEvent.click(screen.getByRole("radio", { name: "Dos" }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("points the group at the text that explains the choice", () => {
    setup({ describedBy: "status-help" });

    expect(screen.getByRole("radiogroup", { name: "Elige" })).toHaveAttribute(
      "aria-describedby",
      "status-help",
    );
  });
});
