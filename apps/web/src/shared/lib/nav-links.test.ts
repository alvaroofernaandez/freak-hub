import { describe, expect, it } from "vitest";
import { bottomNavLinks, navLinks } from "./nav-links";

describe("navLinks", () => {
  it("has exactly the four top-level links, in order", () => {
    expect(navLinks.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Inicio", href: "/inicio" },
      { label: "Biblioteca", href: "/biblioteca" },
      { label: "Actividad", href: "/actividad" },
      { label: "Grupo", href: "/miembros" },
    ]);
  });

  it("gives every link an icon to render", () => {
    for (const link of navLinks) {
      expect(link.Icon).toBeDefined();
    }
  });
});

describe("bottomNavLinks", () => {
  it("carries the four thumb-reachable destinations, in order", () => {
    expect(bottomNavLinks.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Inicio", href: "/inicio" },
      { label: "Biblioteca", href: "/biblioteca" },
      { label: "Actividad", href: "/actividad" },
      { label: "Recom.", href: "/recomendaciones" },
    ]);
  });

  it("gives every link an icon to render", () => {
    for (const link of bottomNavLinks) {
      expect(link.Icon).toBeDefined();
    }
  });

  it("leaves the centre slot free for the add button", () => {
    // Four links plus the add button is five targets: the most a thumb
    // reaches comfortably across the bottom of a phone.
    expect(bottomNavLinks).toHaveLength(4);
  });
});
