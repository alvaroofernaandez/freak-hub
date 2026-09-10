"use client";

import { useClerk } from "@clerk/nextjs";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, Logout, UserAdd, UserCircle } from "reicon-react";
import { Avatar } from "@/features/members/ui/avatar";
import { cn } from "@/shared/lib/cn";
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

  // Not modal: a session menu should not hide the rest of the page from
  // assistive tech, nor lock scrolling behind it.
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-full border border-transparent py-1 pr-1 pl-2 transition-colors duration-150 hover:border-border hover:bg-surface focus-visible:border-border"
        >
          <span className="hidden font-mono text-sm text-ink-muted sm:inline">
            @{username}
          </span>
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
            <Avatar displayName={displayName} imageUrl={avatarUrl} />
          </span>
          <span className="sr-only">{displayName}</span>
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn(
              "hidden text-ink-muted transition-transform duration-150 motion-reduce:transition-none sm:block",
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
                  <DropdownMenu.Item asChild>
                    <Link href="/invitar" className={ITEM_CLASS}>
                      <UserAdd size={16} aria-hidden="true" />
                      Invitar a alguien
                    </Link>
                  </DropdownMenu.Item>
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
