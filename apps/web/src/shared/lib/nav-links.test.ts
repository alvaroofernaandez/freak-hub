import { describe, expect, it } from "vitest";
import { navLinks } from "./nav-links";

describe("navLinks", () => {
  it("has exactly the four top-level links, in order", () => {
    expect(navLinks).toEqual([
      { label: "Inicio", href: "/inicio" },
      { label: "Biblioteca", href: "/biblioteca" },
      { label: "Actividad", href: "/actividad" },
      { label: "Grupo", href: "/miembros" },
    ]);
  });
});
