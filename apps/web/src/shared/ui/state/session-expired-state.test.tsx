import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionExpiredState } from "./session-expired-state";

describe("SessionExpiredState", () => {
  it("links to sign-in with the current path as redirect_url", () => {
    render(<SessionExpiredState size="page" redirectPath="/miembros/alvaro" />);

    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Fmiembros%2Falvaro");
  });

  it("explains what happened", () => {
    render(<SessionExpiredState size="page" redirectPath="/inicio" />);

    expect(
      screen.getByRole("heading", { name: /sesión ha caducado/i }),
    ).toBeInTheDocument();
  });
});
