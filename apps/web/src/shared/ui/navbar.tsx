import Link from "next/link";
import type { ReactNode } from "react";
import { navLinks } from "@/shared/lib/nav-links";

type NavbarProps = {
  pendingRecommendations?: number;
  userSlot?: ReactNode;
};

/** Session navbar shared by every authenticated route (docs/screens.md#navegación). */
export function Navbar({ pendingRecommendations, userSlot }: NavbarProps) {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/inicio" className="font-display text-lg">
          Freak Hub
        </Link>
        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-sm">
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/anadir"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            + Añadir
          </Link>
          {pendingRecommendations ? (
            <output
              aria-label={`${pendingRecommendations} recomendaciones pendientes`}
              className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-accent-ink"
            >
              {pendingRecommendations}
            </output>
          ) : null}
          {userSlot}
        </div>
      </nav>
    </header>
  );
}
