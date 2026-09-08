"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { navLinks } from "@/shared/lib/nav-links";
import { useAddCategoryModal } from "./add-category-modal";

type NavbarProps = {
  pendingRecommendations?: number;
  userSlot?: ReactNode;
};

/** Session navbar shared by every authenticated route (docs/screens.md#navegación). */
export function Navbar({ pendingRecommendations, userSlot }: NavbarProps) {
  const { open: openAddCategoryModal } = useAddCategoryModal();

  return (
    <header className="border-b border-border">
      <nav
        aria-label="Navegación principal"
        className="mx-auto hidden max-w-5xl items-center justify-between gap-5 px-[22px] md:flex md:h-[58px] lg:h-16 lg:gap-8 lg:px-7"
      >
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
          <button
            type="button"
            onClick={openAddCategoryModal}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            + Añadir
          </button>
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
      <nav
        aria-label="Navegación inferior"
        className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t border-border bg-surface md:hidden"
      >
        <Link
          href="/inicio"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center text-xs"
        >
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center text-xs"
        >
          Biblioteca
        </Link>
        <button
          type="button"
          onClick={openAddCategoryModal}
          aria-label="Añadir"
          className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-2xl text-accent-ink shadow-lg"
        >
          +
        </button>
        <Link
          href="/actividad"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center text-xs"
        >
          Actividad
        </Link>
        <Link
          href="/recomendaciones"
          className="flex min-h-11 min-w-11 flex-col items-center justify-center text-xs"
        >
          Recom.
        </Link>
      </nav>
    </header>
  );
}
