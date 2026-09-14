import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import {
  countByCategory,
  toLibraryItem,
} from "@/features/library/lib/library-item";
import type { LibraryEntryPage } from "@/shared/api/types";
import { loadResource } from "@/shared/lib/load-resource";
import { staggerStyle } from "@/shared/motion/tokens";
import { CategoryCard } from "@/shared/ui/category-card";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { AccountPendingState } from "@/shared/ui/state/account-pending-state";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

export const metadata: Metadata = { title: "Biblioteca" };

/** The contract's page-size maximum (docs/api.md#paginación). */
const PAGE_LIMIT = 100;

function LobbyHeading() {
  return (
    <h1 className="text-[24px] font-bold text-ink md:text-[25px] xl:text-[28px]">
      Tu biblioteca
    </h1>
  );
}

/**
 * The lobby: the six categories as the entry point into the library
 * (docs/screens.md). The category grid is part of the domain, not data, so
 * it always renders — but the figure on each card is now the real count of
 * that category's entries, not the zero it showed while `/v1/library` went
 * unread.
 *
 * One request, not six: `GET /v1/library` answers with every category at
 * once and the counting happens here, which is both fewer round trips and
 * the only way six figures can be guaranteed to describe the same instant.
 */
export default async function LibraryLobbyPage() {
  const { getToken } = await auth();
  const token = await getToken();

  const state = await loadResource<LibraryEntryPage>(
    `/v1/library?limit=${PAGE_LIMIT}`,
    { token, resource: "tu biblioteca", route: "/biblioteca" },
  );

  if (state.status === "error") {
    if (state.error.kind === "session_expired") {
      return <SessionExpiredState size="page" redirectPath="/biblioteca" />;
    }
    if (state.error.kind === "account_pending") {
      return <AccountPendingState size="page" />;
    }

    return (
      <section className="space-y-[22px] md:space-y-[18px] xl:space-y-[30px]">
        <LobbyHeading />
        <ErrorState error={state.error} size="section" />
      </section>
    );
  }

  const counts = countByCategory(state.data.items.map(toLibraryItem));

  return (
    <section className="space-y-[22px] md:space-y-[18px] xl:space-y-[30px]">
      <LobbyHeading />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:gap-5">
        {CATEGORY_ORDER.map((category, index) => (
          <CategoryCard
            key={category}
            category={category}
            count={counts[category]}
            href={`/biblioteca/${category}`}
            className="stagger-in"
            style={staggerStyle(index) as CSSProperties}
          />
        ))}
      </div>
      {/* A count that silently stopped at 100 would be a wrong number, not a
          truncated list, so it says so rather than reading as fact
          (docs/states.md, ADR-0014). */}
      {state.data.next_cursor === null ? null : (
        <p
          data-testid="library-counts-partial"
          className="text-sm text-ink-muted"
        >
          Tienes más de {PAGE_LIMIT} obras: estos recuentos solo incluyen las{" "}
          {PAGE_LIMIT} más recientes.
        </p>
      )}
    </section>
  );
}
