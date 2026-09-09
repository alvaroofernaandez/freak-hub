"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Plus } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { bottomNavLinks, navLinks } from "@/shared/lib/nav-links";
import { useAddCategoryModal } from "./add-category-modal";

type NavbarProps = {
  pendingRecommendations?: number;
  userSlot?: ReactNode;
};

/** Session navbar shared by every authenticated route (docs/screens.md#navegación). */
export function Navbar({ pendingRecommendations, userSlot }: NavbarProps) {
  const { open: openAddCategoryModal } = useAddCategoryModal();
  const pathname = usePathname();

  /** A section stays current while you are anywhere inside it. */
  function isCurrent(href: string): boolean {
    return pathname === href || pathname?.startsWith(`${href}/`) === true;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-ground">
      {/*
       * Tabbing into the page should not mean walking through every nav item
       * first. Hidden until focused, which is the only time it is useful.
       */}
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-ink"
      >
        Saltar al contenido
      </a>

      <nav
        aria-label="Navegación principal"
        className="mx-auto hidden max-w-5xl items-center justify-between gap-5 px-[22px] md:flex md:h-[58px] lg:h-16 lg:gap-8 lg:px-7"
      >
        <Link
          href="/inicio"
          className="font-display text-lg transition-opacity duration-150 hover:opacity-80"
        >
          Freak Hub
        </Link>
        <div className="flex items-center gap-5 lg:gap-6">
          {navLinks.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isCurrent(href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 text-sm transition-colors duration-150 hover:text-accent",
                isCurrent(href) ? "font-medium text-ink" : "text-ink-muted",
              )}
            >
              <Icon
                size={16}
                aria-hidden="true"
                weight={isCurrent(href) ? "Filled" : "Outline"}
              />
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={openAddCategoryModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            <Plus size={16} aria-hidden="true" />
            Añadir
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
        className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {bottomNavLinks.slice(0, 2).map(({ href, label, Icon }) => (
          <BottomLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            current={isCurrent(href)}
          />
        ))}

        <button
          type="button"
          onClick={openAddCategoryModal}
          aria-label="Añadir"
          className="-mt-6 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg transition-opacity duration-150 hover:opacity-90"
        >
          <Plus size={24} aria-hidden="true" />
        </button>

        {bottomNavLinks.slice(2).map(({ href, label, Icon }) => (
          <BottomLink
            key={href}
            href={href}
            label={label}
            Icon={Icon}
            current={isCurrent(href)}
          />
        ))}
      </nav>
    </header>
  );
}

type BottomLinkProps = {
  href: string;
  label: string;
  Icon: (typeof navLinks)[number]["Icon"];
  current: boolean;
};

/** One destination in the mobile bottom bar: icon over label, thumb-sized. */
function BottomLink({ href, label, Icon, current }: BottomLinkProps) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 min-w-11 flex-col items-center justify-center gap-1 text-[11px] transition-colors duration-150 hover:text-accent",
        current ? "font-medium text-ink" : "text-ink-muted",
      )}
    >
      <Icon
        size={20}
        aria-hidden="true"
        weight={current ? "Filled" : "Outline"}
      />
      {label}
    </Link>
  );
}
