"use client";

import { useClerk } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import {
  Check,
  ChevronDown,
  Gear,
  Logout,
  UserAdd,
  UserCircle,
  Users,
} from "reicon-react";
import { Avatar } from "@/features/members/ui/avatar";
import { cn } from "@/shared/lib/cn";
import { useTheme } from "@/shared/lib/use-theme";
import { DURATION, EXIT_RATIO, variants } from "@/shared/motion/tokens";

const ENTER_TRANSITION = { duration: DURATION.fast };
const EXIT_TRANSITION = { duration: DURATION.fast * EXIT_RATIO };

type UserMenuProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

const ITEM_CLASS =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-ink-muted outline-none transition-colors duration-150 data-[highlighted]:bg-surface-raised data-[highlighted]:text-ink";

/**
 * The session menu: your identity and what you can do with it. Built on Radix
 * rather than Clerk's `<UserButton>` so the whole surface follows the project's
 * own tokens; Clerk stays underneath, only as the `signOut` call.
 *
 * Radix owns the menu semantics (roles, roving focus, typeahead, Escape,
 * outside click, focus return), which is a lot of behaviour not worth
 * hand-rolling per app.
 */
export function UserMenu({ displayName, username, avatarUrl }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();

  // Not modal: a session menu should not hide the rest of the page from
  // assistive tech, nor lock scrolling behind it.
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-full border border-transparent py-1 pr-1 pl-2 transition-colors duration-150 hover:border-border hover:bg-surface focus-visible:border-border"
        >
          {/*
           * The handle waits for 1024 px, the width of the tablet artboard.
           * Between 768 and 1023 px the header row is already 43 px wider
           * than the viewport with it: the wordmark wrapped onto two lines
           * and this trigger was clipped (issue #63). The avatar carries the
           * identity in that band, as both artboards draw it.
           */}
          <span className="hidden font-mono text-sm text-ink-muted lg:inline">
            @{username}
          </span>
          {/*
           * The picture is decorative here: `Avatar` labels its <img> with
           * the display name, and the sr-only span below already says it. Two
           * sources announced it twice to anyone whose avatar had loaded.
           * The span stays rather than the alt text, because with no picture
           * `Avatar` falls back to initials it hides from assistive tech, and
           * this trigger cannot afford to go unnamed: on a phone it is the
           * only way to reach the session.
           */}
          <span
            aria-hidden="true"
            className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
          >
            <Avatar displayName={displayName} imageUrl={avatarUrl} />
          </span>
          <span className="sr-only">{displayName}</span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn(
              "hidden text-ink-muted transition-transform duration-150 motion-reduce:transition-none lg:block",
              isOpen && "rotate-180",
            )}
          />
        </button>
      </DropdownMenu.Trigger>

      <AnimatePresence>
        {isOpen ? (
          <DropdownMenu.Portal forceMount>
            <DropdownMenu.Content
              asChild
              forceMount
              align="end"
              sideOffset={8}
              aria-label={`Sesión de ${displayName}`}
            >
              <m.div
                className="z-40 w-60 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
                initial={variants.popover.hidden}
                animate={{
                  ...variants.popover.shown,
                  transition: ENTER_TRANSITION,
                }}
                exit={{ ...variants.popover.exit, transition: EXIT_TRANSITION }}
              >
                <div className="border-b border-border-soft px-3 pt-2 pb-3">
                  <p className="truncate text-sm font-medium text-ink">
                    {displayName}
                  </p>
                  <p className="truncate font-mono text-xs text-ink-muted">
                    @{username}
                  </p>
                </div>

                <div className="pt-1.5">
                  <DropdownMenu.Item asChild>
                    <Link href={`/miembros/${username}`} className={ITEM_CLASS}>
                      <UserCircle size={16} aria-hidden="true" />
                      Mi perfil
                    </Link>
                  </DropdownMenu.Item>
                  {/*
                   * Only on a phone. The mobile bottom bar traded "Grupo" for
                   * "Recomendaciones", so below 768 px this is the only route
                   * to /miembros (issue #63); above it the navbar already
                   * carries the link and a second entry would repeat what is
                   * one click away, which is the same reason /recomendaciones
                   * stays out of this menu.
                   *
                   * `md:hidden` on a Radix item is safe as long as it is not
                   * the first one: `display: none` takes it out of the
                   * accessibility tree, and Radix's roving focus skips it on
                   * its own, because it focuses a candidate and then checks
                   * whether `document.activeElement` actually moved. The
                   * first item is the one that carries `tabindex="0"`, so
                   * hiding that one would cost the menu its tab stop.
                   */}
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/miembros"
                      className={cn(ITEM_CLASS, "md:hidden")}
                    >
                      <Users size={16} aria-hidden="true" />
                      Grupo
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/invitar" className={ITEM_CLASS}>
                      <UserAdd size={16} aria-hidden="true" />
                      Invitar a alguien
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link href="/ajustes" className={ITEM_CLASS}>
                      <Gear size={16} aria-hidden="true" />
                      Ajustes
                    </Link>
                  </DropdownMenu.Item>
                  {/*
                   * A checkbox item, not a plain one: it carries a state, and
                   * `menuitemcheckbox` is what announces that state. It keeps
                   * the menu open on select, because switching the theme is
                   * not a reason to lose your place — and the full switch,
                   * with its explanation, still lives in /ajustes.
                   */}
                  <DropdownMenu.CheckboxItem
                    className={ITEM_CLASS}
                    checked={theme === "light"}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? "light" : "dark")
                    }
                  >
                    <span className="flex w-4 justify-center">
                      <DropdownMenu.ItemIndicator>
                        <Check size={14} aria-hidden="true" />
                      </DropdownMenu.ItemIndicator>
                    </span>
                    Tema claro
                  </DropdownMenu.CheckboxItem>
                  <DropdownMenu.Item
                    className={ITEM_CLASS}
                    onSelect={() => signOut()}
                  >
                    <Logout size={16} aria-hidden="true" />
                    Cerrar sesión
                  </DropdownMenu.Item>
                </div>
              </m.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        ) : null}
      </AnimatePresence>
    </DropdownMenu.Root>
  );
}
