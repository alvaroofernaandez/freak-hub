import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toLibraryItem } from "@/features/library/lib/library-item";
import { CategoryWorksBrowser } from "@/features/library/ui/category-works-browser";
import type { LibraryEntryPage, WorkCategory } from "@/shared/api/types";
import { loadResource } from "@/shared/lib/load-resource";
import { SetActiveCategory } from "@/shared/ui/active-category";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";
import { AccountPendingState } from "@/shared/ui/state/account-pending-state";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

type CategoryLibraryPageProps = {
  params: Promise<{ categoria: string }>;
};

/** The contract's page-size maximum (docs/api.md#paginación). */
const PAGE_LIMIT = 100;

function isWorkCategory(value: string): value is WorkCategory {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: CategoryLibraryPageProps): Promise<Metadata> {
  const { categoria } = await params;
  return { title: isWorkCategory(categoria) ? CATEGORY_LABELS[categoria] : "" };
}

function countLabel(count: number): string {
  return count === 1 ? "1 obra" : `${count} obras`;
}

/**
 * A category's own library listing (docs/screens.md,
 * docs/design/high-fidelity-desktop.html §3). The entries come from
 * `GET /v1/library?category=`, filtered by the API rather than here: asking
 * for one category is one request instead of fetching the whole library and
 * throwing five sixths of it away.
 *
 * Each entry carries its whole `Work` inline, so a grid of titles and covers
 * costs exactly this one request — there is no per-card lookup to make.
 */
export default async function CategoryLibraryPage({
  params,
}: CategoryLibraryPageProps) {
  const { categoria } = await params;

  if (!isWorkCategory(categoria)) {
    notFound();
  }

  const label = CATEGORY_LABELS[categoria];
  const { getToken } = await auth();
  const token = await getToken();

  const state = await loadResource<LibraryEntryPage>(
    `/v1/library?category=${categoria}&limit=${PAGE_LIMIT}`,
    { token, resource: `tu biblioteca de ${label}`, route: "/biblioteca" },
  );

  if (state.status === "error") {
    if (state.error.kind === "session_expired") {
      return (
        <SessionExpiredState
          size="page"
          redirectPath={`/biblioteca/${categoria}`}
        />
      );
    }
    if (state.error.kind === "account_pending") {
      return <AccountPendingState size="page" />;
    }

    return (
      <section className="space-y-6">
        <SetActiveCategory category={categoria} />
        <h1 className="text-3xl font-semibold">{label}</h1>
        <ErrorState error={state.error} size="section" />
      </section>
    );
  }

  const items = state.data.items.map(toLibraryItem);

  return (
    <section className="space-y-6">
      <SetActiveCategory category={categoria} />
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h1 className="text-3xl font-semibold">{label}</h1>
        {/* The figure the mockup puts beside the title (§3), which had
            nothing to count until now. */}
        <span
          data-testid="category-count"
          className="font-mono text-[13px] text-ink-muted"
        >
          {countLabel(items.length)}
        </span>
      </div>
      <CategoryWorksBrowser items={items} category={categoria} />
      {state.data.next_cursor === null ? null : (
        <p data-testid="category-has-more" className="text-sm text-ink-muted">
          Hay más obras de las que caben en esta página: se muestran las{" "}
          {PAGE_LIMIT} más recientes.
        </p>
      )}
    </section>
  );
}
