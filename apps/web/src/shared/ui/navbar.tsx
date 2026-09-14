"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Plus } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { bottomNavLinks, navLinks } from "@/shared/lib/nav-links";
import { useOfflineNoticeVisible } from "@/shared/lib/use-offline-notice-visible";
import { useAddCategoryModal } from "./add-category-modal";

type NavbarProps = {
  pendingRecommendations?: number;
  userSlot?: ReactNode;
};

/** Session navbar shared by every authenticated route (docs/screens.md#navegación). */
export function Navbar({ pendingRecommendations, userSlot }: NavbarProps) {
  const { open: openAddCategoryModal } = useAddCategoryModal();
  const pathname = usePathname();
  const { visible: offlineNoticeVisible } = useOfflineNoticeVisible();

  /** A section stays current while you are anywhere inside it. */
  function isCurrent(href: string): boolean {
    return pathname === href || pathname?.startsWith(`${href}/`) === true;
  }

  return (
    <header
      className={cn(
        "sticky z-30 border-b border-border bg-ground",
        // OfflineNotice is sticky at top-0 with a higher z-index: while it
        // is on screen, the header sticks right below it instead of both
        // pinning to the same y=0 and overlapping (docs/states.md).
        offlineNoticeVisible ? "top-9" : "top-0",
      )}
    >
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

      {/*
       * Present at every width. It used to be `hidden md:flex`, which left a
       * 1 px header on a phone: no wordmark, no badge and no session menu, so
       * signing out was unreachable there (issue #63). Below `md` it keeps
       * only what the `(móvil)` artboard draws — wordmark, badge, avatar —
       * and hands the destinations to the bottom bar.
       *
       * The metrics follow the three artboards: 56/16/12 at 390 px,
       * 58/22/20 at 1024 px and 64/28/32 at 1440 px. Desktop starts at `xl`
       * (1280 px) and not at `lg` (1024 px), because 1024 px *is* the tablet
       * artboard: the tablet variant never rendered at the width it was drawn
       * for. The whole app follows that rule now, and
       * `app/desktop-breakpoint.test.ts` keeps it that way.
       */}
      <nav
        aria-label="Navegación principal"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:h-[58px] md:gap-5 md:px-[22px] xl:h-16 xl:gap-8 xl:px-7"
      >
        <Link
          href="/inicio"
          className="font-display text-lg whitespace-nowrap transition-opacity duration-150 hover:opacity-80"
        >
          Freak Hub
        </Link>
        <div className="hidden items-center gap-5 md:flex xl:gap-6">
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
        <div className="flex items-center gap-0.5 md:gap-3 xl:gap-4">
          {/* The phone reaches "Añadir" through the centre button of the
              bottom bar, so the header does not repeat it there. */}
          <button
            type="button"
            onClick={openAddCategoryModal}
            className="hidden items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 md:inline-flex"
          >
            <Plus size={16} aria-hidden="true" />
            Añadir
          </button>
          {pendingRecommendations ? (
            /*
             * The only notification badge in the product (docs/screens.md), so
             * it has to lead somewhere: the screen that lists what is waiting
             * on you. A count you cannot act on is a decoration.
             */
            <Link
              href="/recomendaciones"
              aria-label={
                pendingRecommendations === 1
                  ? "1 recomendación pendiente"
                  : `${pendingRecommendations} recomendaciones pendientes`
              }
              aria-current={isCurrent("/recomendaciones") ? "page" : undefined}
              /*
               * The tap area is the 44 px box of the `(móvil)` artboard, not
               * the pill: 24 px clears WCAG 2.2 for a pointer, not for a
               * thumb. Above `md` the box collapses back to the pill so the
               * header keeps the spacing the tablet and desktop artboards
               * draw.
               */
              className="flex min-h-11 min-w-11 items-center justify-center transition-opacity duration-150 hover:opacity-90 md:min-h-0 md:min-w-0"
            >
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-medium text-accent-ink">
                {pendingRecommendations}
              </span>
            </Link>
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
