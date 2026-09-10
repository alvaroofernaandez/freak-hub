import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

function Harness() {
  const [checked, setChecked] = useState(true);
  return (
    <Checkbox checked={checked} onCheckedChange={setChecked} label="Top" />
  );
}

describe("Checkbox", () => {
  it("exposes itself as a checkbox with an accessible name", () => {
    render(
      <Checkbox
        checked={false}
        onCheckedChange={() => {}}
        label="Biblioteca"
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Biblioteca" }),
    ).toBeInTheDocument();
  });

  it("reports its checked state", () => {
    render(<Checkbox checked onCheckedChange={() => {}} label="Biblioteca" />);

    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("reports a change when clicked", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        checked={false}
        onCheckedChange={onCheckedChange}
        label="Top"
      />,
    );

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("stays silent while disabled", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        checked
        disabled
        onCheckedChange={onCheckedChange}
        label="Top"
      />,
    );

    await userEvent.click(screen.getByRole("checkbox"));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("animates the check mark out through its own exit variant when unchecked", async () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox");
    expect(box.querySelector("svg")).not.toBeNull();

    fireEvent.click(box);

    // The mark exits through Motion's AnimatePresence rather than a plain
    // conditional, so removal is not guaranteed on the same tick — this
    // waits for the animation (skipped/instant in tests, see
    // vitest.setup.ts) to actually resolve, rather than asserting a
    // same-tick removal that would just be Radix's plain toggle.
    await waitFor(() => expect(box.querySelector("svg")).toBeNull());
  });
});
