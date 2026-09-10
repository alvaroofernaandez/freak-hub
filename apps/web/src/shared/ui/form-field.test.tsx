import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("wires the label to the field by id", () => {
    render(
      <FormField id="email" label="Correo">
        {(aria) => <input {...aria} />}
      </FormField>,
    );

    expect(screen.getByLabelText("Correo")).toHaveAttribute("id", "email");
  });

  it("shows an optional helper, referenced by aria-describedby", () => {
    render(
      <FormField id="avatar" label="Foto" helperText="Hasta 5 MB.">
        {(aria) => <input {...aria} type="file" />}
      </FormField>,
    );

    const field = screen.getByLabelText("Foto");
    const helper = screen.getByText("Hasta 5 MB.");
    expect(field.getAttribute("aria-describedby")).toContain(helper.id);
  });

  it("ties a field error to the input via aria-invalid and aria-describedby, and flags it for assistive tech", () => {
    render(
      <FormField id="username" label="Usuario" errorText="Ya está cogido.">
        {(aria) => <input {...aria} />}
      </FormField>,
    );

    const field = screen.getByLabelText("Usuario");
    const error = screen.getByText("Ya está cogido.");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")).toContain(error.id);
    expect(error).toHaveAttribute("role", "alert");
  });

  it("describes the field by both helper and error together, when both are present", () => {
    render(
      <FormField
        id="username"
        label="Usuario"
        helperText="Entre 3 y 24 caracteres."
        errorText="Ya está cogido."
      >
        {(aria) => <input {...aria} />}
      </FormField>,
    );

    const field = screen.getByLabelText("Usuario");
    const describedBy = field.getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain(screen.getByText("Ya está cogido.").id);
    expect(
      describedBy.includes(screen.getByText("Entre 3 y 24 caracteres.").id),
    ).toBe(true);
  });

  it("has no aria-invalid at all when there is no error", () => {
    render(
      <FormField id="email" label="Correo">
        {(aria) => <input {...aria} />}
      </FormField>,
    );

    expect(screen.getByLabelText("Correo")).not.toHaveAttribute("aria-invalid");
  });
});
