import type { IconComponent } from "reicon-react";
import { Home, Library, Pulse, Sparkles, Users } from "reicon-react";

export type NavLink = {
  label: string;
  href: string;
  Icon: IconComponent;
};

/** Top-level navigation, per docs/screens.md and ADR-0009. */
export const navLinks: NavLink[] = [
  { label: "Inicio", href: "/inicio", Icon: Home },
  { label: "Biblioteca", href: "/biblioteca", Icon: Library },
  { label: "Actividad", href: "/actividad", Icon: Pulse },
  { label: "Grupo", href: "/miembros", Icon: Users },
];

/**
 * The mobile bottom bar. It drops "Grupo" for "Recomendaciones" because the
 * add button takes the centre slot and five items is the most a thumb reaches
 * comfortably; the group stays one tap away from the profile menu.
 */
export const bottomNavLinks: NavLink[] = [
  { label: "Inicio", href: "/inicio", Icon: Home },
  { label: "Biblioteca", href: "/biblioteca", Icon: Library },
  { label: "Actividad", href: "/actividad", Icon: Pulse },
  { label: "Recom.", href: "/recomendaciones", Icon: Sparkles },
];
