import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

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
});
