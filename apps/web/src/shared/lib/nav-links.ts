export type NavLink = {
  label: string;
  href: string;
};

/** Top-level navigation, per docs/screens.md and ADR-0009. */
export const navLinks: NavLink[] = [
  { label: "Inicio", href: "/inicio" },
  { label: "Biblioteca", href: "/biblioteca" },
  { label: "Actividad", href: "/actividad" },
  { label: "Grupo", href: "/miembros" },
];
